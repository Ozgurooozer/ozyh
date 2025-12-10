import { GoogleGenAI } from "@google/genai";
import { SpriteStyle, SpriteDirection } from "../types";

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data URL prefix
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

const getStylePrompt = (style: SpriteStyle): string => {
  const common = "PURE WHITE BACKGROUND. No shadows, no gradients on background. UNIFORM LIGHTING from Top-Left.";
  switch (style) {
    case 'PIXEL_ART':
      return `Pixel art style, precise pixel grid, limited color palette, retro 16-bit aesthetic, sharp hard edges, no anti-aliasing. ${common}`;
    case 'FLAT_VECTOR':
      return `Modern flat vector art, clean distinct shapes, no gradients, adobe illustrator style, thick bold outlines, cell shading. ${common}`;
    case 'SKETCH':
      return `Rough hand-drawn sketch style, pencil lines, loose artistic strokes, concept art aesthetic. ${common}`;
    case 'NEO_RETRO':
    default:
      return `Neo-retro anime style, 90s fighting game aesthetic, cel-shading, hard thick outlines, professional game asset quality. ${common}`;
  }
};

/**
 * Uses Gemini 2.5 Flash Image to generate the sprite sheet with structured prompting.
 */
export const generateSpriteSheet = async (
  imageBase64: string,
  mimeType: string,
  actionLogic: string,
  style: SpriteStyle,
  direction: SpriteDirection,
  customPositive: string,
  customNegative: string,
  poseBase64?: string
): Promise<string> => {
  const ai = getClient();
  
  const styleInstruction = getStylePrompt(style);

  // The GodMode Prompt Logic
  let fullPrompt = "";

  if (poseBase64) {
    fullPrompt = `
    [CRITICAL - IDENTITY PRESERVATION]
    1. SOURCE OF TRUTH: Image 1 is the absolute reference.
    2. NO HALLUCINATIONS: If Image 1 is a bald mannequin, the output MUST be a bald mannequin. DO NOT add hair, eyes, nose, or mouth if they are missing in the source.
    3. NO BEAUTIFICATION: Do not 'improve' the character design or add clothing details not present in Image 1.
    4. EXACT MATCH: Keep the exact clothes, colors, and skin texture of Image 1.

    ROLE: You are a Lead Technical Animator & Character Artist.
    TASK: Retarget the character design from IMAGE 1 onto the Volumetric Guide in IMAGE 2.
    
    [INPUTS PROVIDED]
    IMAGE 1: CHARACTER REFERENCE (Style, Colors, Costume).
    IMAGE 2: VOLUMETRIC POSE GUIDE (Geometry, Depth, Anatomy).

    [GUIDE INTERPRETATION RULES - CRITICAL]
    1. DEPTH CODING: Image 2 uses grayscale depth coding. 
       - BLACK/DARK GREY capsules are FOREGROUND limbs (Left side usually).
       - LIGHT GREY capsules are BACKGROUND limbs (Right side usually).
       - SOLID DOTS are JOINTS (Shoulders, Elbows, Knees).
       - Draw the character's limbs respecting this depth order.
    2. VOLUMETRIC CAPSULES: The thick lines in Image 2 represent the ACTUAL THICKNESS/VOLUME of the character. Fill this volume exactly. RASTERIZE THE CAPSULES.
    3. CAMERA ANGLE: The guide is set to ${direction} view. Adjust facial features (using the face vector line on the head) and clothing perspective to match ${direction}.
    4. LEFT/RIGHT PROFILE: If the direction is SIDE_LEFT, the character MUST face LEFT. If SIDE, the character MUST face RIGHT.

    [CRITICAL - PHYSICS & CONSISTENCY]
    1. GROUND LOCK: The character's feet must align perfectly with the horizontal floor lines in Image 2.
    2. VOLUME LOCK: The character's silhouette must fit exactly inside the guide shapes.
    3. LIGHTING CONSISTENCY: Use a global light source from the TOP-LEFT. Shadows must be consistent across all 6 frames.
    
    [CRITICAL - ANIMATION LOOP]
    1. SEAMLESS LOOP: Frame 6 must visually transition back to Frame 1. 
    2. CYCLICAL FLOW: Ensure the motion is continuous.

    [RULES]
    1. Match the exact limb positions of Image 2.
    2. Do not change the composition or grid layout of Image 2.
    3. STRICT 6-COLUMN GRID: The output must match the 6-column layout of the pose guide exactly.
    `;
  } else {
    // Fallback logic
    fullPrompt = `
    ROLE: You are a Senior Technical Artist.
    TASK: Create a professional 6-frame sprite sheet.
    CONTEXT: The character is a FICTIONAL GAME ASSET.
    DIRECTION: ${direction} View.
    
    [INPUTS]
    IMAGE 1: REFERENCE CHARACTER.

    [ANIMATION LOGIC]
    ${actionLogic}

    [CRITICAL - CONSISTENCY]
    1. VOLUME LOCK: The character's size (head-to-toe height and width) MUST be identical in every frame. Do not zoom in or out.
    2. GROUND CONTACT: For Idle/Walk/Attack, the feet must align with the same Y-axis baseline. No floating.
    3. LIGHTING: Consistent Top-Left lighting.

    [CRITICAL - LAYOUT]
    1. STRICT 6-COLUMN GRID: The output image must be composed of exactly 6 equal vertical columns.
    2. SPACING: Center the character perfectly in each of the 6 columns.
    `;
  }

  fullPrompt += `
    [ART STYLE]
    ${styleInstruction}

    [ADDITIONAL INSTRUCTIONS]
    ${customPositive}

    [ANATOMY CHECK]
    Hands must have 5 clear fingers. No fused fingers. Correct joint articulation.
    
    [NEGATIVE CONSTRAINTS]
    ${customNegative}
  `;

  // Prepare contents parts
  // Order matters: Text -> Image 1 (Style) -> Image 2 (Pose)
  const parts: any[] = [
    { text: fullPrompt },
    {
      inlineData: {
        mimeType: mimeType,
        data: imageBase64,
      },
    }
  ];

  // If a pose guide is provided, add it as the second image
  if (poseBase64) {
    parts.push({
      inlineData: {
        mimeType: 'image/png', // Assuming pose templates are PNGs
        data: poseBase64
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "16:9", // Optimal for horizontal strips
        }
      }
    });

    // Enhanced Response Handling
    if (response.candidates && response.candidates.length > 0) {
        // 1. Prioritize finding an image
        for (const candidate of response.candidates) {
            for (const part of candidate.content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    return `data:image/png;base64,${part.inlineData.data}`;
                }
            }
        }
        
        // 2. If no image, check for text (refusal/explanation)
        let refusalText = "";
        for (const candidate of response.candidates) {
            for (const part of candidate.content.parts) {
                if (part.text) {
                    refusalText += part.text + " ";
                }
            }
        }
        
        if (refusalText) {
            console.warn("Model Refusal:", refusalText);
            throw new Error(`Generation Refused: ${refusalText.trim().slice(0, 150)}... (Try a simpler prompt or different image)`);
        }
    }
    
    throw new Error("No image data found. The model may have filtered the output silently.");

  } catch (error) {
    console.error("Sprite generation error:", error);
    throw error;
  }
};

/**
 * Generates dynamic intermediate frames (Tweening) with flexible counts (4, 3, 2, 1).
 */
export const generateDynamicInBetweens = async (sourceImageBase64: string, targetCount: number): Promise<string> => {
  const ai = getClient();
  
  const prompt = `
    ROLE: Expert 2D Animator (Tweening Specialist).
    TASK: Generate exactly ${targetCount} NEW intermediate frames (In-betweens) derived from the provided sprite sheet.

    [INPUT CONTEXT]
    The provided image contains a sequence of animation keyframes.
    Your job is to analyze the motion between these frames and generate the "Missing Links" or "Breakdowns" that would fit BETWEEN the existing poses.

    [OUTPUT REQUIREMENTS]
    1. IMAGE LAYOUT: Create a single horizontal strip with exactly ${targetCount} equal columns.
    2. CONTENT MAPPING:
       - You must generate ${targetCount} frames that represent the mathematical blending of the input poses.
       - If input has N frames, imagine the ${targetCount} frames are evenly distributed in the gaps.

    [STRICT CONSISTENCY RULES]
    1. EXACT CHARACTER MATCH: Use the exact same colors, outline thickness, and shading style as the input.
    2. ALIGNMENT: The feet must be on the exact same ground line as the input.
    3. VOLUME: Do not shrink or grow the character. The pixel mass must be identical.
    4. BACKGROUND: Pure white background.

    Output ONLY the ${targetCount} new frames in a single image strip.
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { text: prompt },
                { inlineData: { mimeType: 'image/png', data: sourceImageBase64 } }
            ]
        },
        config: {
            imageConfig: {
                aspectRatio: "16:9" 
            }
        }
    });

    for (const candidate of response.candidates || []) {
        for (const part of candidate.content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error("Failed to generate in-between frames.");

  } catch (error) {
    console.error("Tweening error:", error);
    throw error;
  }
};

/**
 * Generates transition frames between the current image and a target action.
 */
export const generateActionBridge = async (sourceImageBase64: string, targetActionDescription: string): Promise<string> => {
    const ai = getClient();
    
    const prompt = `
      ROLE: Lead Game Animator.
      TASK: Generate a 5-frame TRANSITION SEQUENCE (Bridge) that morphs the character from the provided input pose into a NEW action.
  
      [INPUT]
      IMAGE: The starting pose/style of the character.
      TARGET ACTION: ${targetActionDescription}
  
      [OUTPUT LOGIC - 5 FRAMES]
      Frame 1: Identical to the LAST frame of the input image (Continuity).
      Frame 2: Slight movement towards the target action (Anticipation).
      Frame 3: Mid-point blend (Morphing).
      Frame 4: Approaching the target action.
      Frame 5: The FIRST frame of the target action (${targetActionDescription}).
  
      [STRICT CONSISTENCY]
      1. STYLE LOCK: You MUST use the exact design, colors, and proportions of the input image.
      2. SMOOTHNESS: The change must be linear and fluid.
      3. LAYOUT: Output exactly 5 equal vertical columns.
      4. BACKGROUND: Pure white.
    `;
  
    try {
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
              parts: [
                  { text: prompt },
                  { inlineData: { mimeType: 'image/png', data: sourceImageBase64 } }
              ]
          },
          config: {
              imageConfig: {
                  aspectRatio: "16:9" 
              }
          }
      });
  
      for (const candidate of response.candidates || []) {
          for (const part of candidate.content.parts) {
              if (part.inlineData && part.inlineData.data) {
                  return `data:image/png;base64,${part.inlineData.data}`;
              }
          }
      }
      throw new Error("Failed to generate transition bridge.");
  
    } catch (error) {
      console.error("Bridge generation error:", error);
      throw error;
    }
  };

/**
 * Uses Gemini 3 Pro Reasoning to refine prompts
 */
export const refinePromptWithReasoning = async (userConcept: string): Promise<string> => {
  const ai = getClient();

  const systemInstruction = `
    You are an expert Game Animator. Convert user requests into technical animation specs.
    Focus on: VISIBILITY of motion, EXAGGERATION principles, and ANATOMICAL consistency.
    Output only the technical description of the frames.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Concept: ${userConcept}`,
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: {
          thinkingBudget: 2048, 
        }
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Reasoning error:", error);
    throw error;
  }
};