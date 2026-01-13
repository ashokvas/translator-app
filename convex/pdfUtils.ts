"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Count pages in a PDF file
 * This action runs in Node.js runtime to use pdf-parse library
 */
export const countPdfPages = action({
  args: {
    pdfBuffer: v.bytes(), // PDF file as bytes
  },
  handler: async (ctx, args) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse");
      const pdfData = await pdfParse(Buffer.from(args.pdfBuffer));
      return pdfData.numpages || 1;
    } catch (pdfError) {
      // Fallback: count pages by searching PDF structure
      try {
        const pdfString = Buffer.from(args.pdfBuffer).toString("binary");
        const pageTypeMatches = pdfString.match(/\/Type\s*\/Page[\s\/]/g);
        if (pageTypeMatches && pageTypeMatches.length > 0) {
          return pageTypeMatches.length;
        } else {
          // Estimate based on file size (roughly 150KB per page)
          return Math.max(1, Math.ceil(args.pdfBuffer.byteLength / 150000));
        }
      } catch {
        // Final fallback: estimate based on file size
        return Math.max(1, Math.ceil(args.pdfBuffer.byteLength / 150000));
      }
    }
  },
});
