import { GoogleGenAI } from "@google/genai";
import { SpriteStyle } from "../types";

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
  const common = "PURE WHITE BACKGROUND. No shadows, no gradients on background.";
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
    ROLE: You are a Senior Technical Artist at a top-tier 2D game studio.
    TASK: Transfer the Character from IMAGE 1 onto the Geometry of IMAGE 2.
    
    [INPUTS PROVIDED]
    IMAGE 1: THE CHARACTER STYLE SOURCE (The "Paint").
    IMAGE 2: THE STRUCTURAL POSE GUIDE (The "Canvas").

    [CRITICAL - IDENTITY PRESERVATION]
    1. SOURCE OF TRUTH: Image 1 is the absolute reference.
    2. NO HALLUCINATIONS: If Image 1 is a bald mannequin, the output MUST be a bald mannequin. DO NOT add hair, eyes, nose, or mouth if they are missing in the source.
    3. NO BEAUTIFICATION: Do not 'improve' the character design or add clothing details not present in Image 1.
    4. EXACT MATCH: Keep the exact clothes, colors, and skin texture of Image 1.

    [CRITICAL - ANIMATION LOOP]
    1. SEAMLESS LOOP: Frame 6 must visually transition back to Frame 1. 
    2. CYCLICAL FLOW: Ensure the motion is continuous (e.g., for running: Contact -> Recoil -> Passing -> High Point -> Contact).

    [RULES]
    1. Match the exact limb positions of Image 2 (The Pose Guide).
    2. Do not change the composition or grid layout of Image 2.
    3. STRICT 6-COLUMN GRID: The output must match the 6-column layout of the pose guide exactly.
    `;
  } else {
    // Fallback logic if no pose guide is present (Standard generation)
    fullPrompt = `
    ROLE: You are a Senior Technical Artist.
    TASK: Create a professional 6-frame sprite sheet.
    CONTEXT: The character is a FICTIONAL GAME ASSET.
    
    [INPUTS]
    IMAGE 1: REFERENCE CHARACTER.

    [ANIMATION LOGIC]
    ${actionLogic}

    [CRITICAL - LAYOUT]
    1. STRICT 6-COLUMN GRID: The output image must be composed of exactly 6 equal vertical columns.
    2. SPACING: Center the character perfectly in each of the 6 columns.
    3. NO OVERLAP: Characters must NOT touch the edges of their imaginary columns.
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
