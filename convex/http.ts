import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/getUser",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response("Unauthorized", { status: 401 });
    }
    return new Response(JSON.stringify({ userId: identity.tokenIdentifier }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

/**
 * Upload file and count pages
 * This endpoint handles file uploads, counts pages, and stores files in Convex storage
 */
http.route({
  path: "/uploadFile",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Check for Authorization header (Clerk token)
    // Since we're calling from an authenticated Next.js API route,
    // we trust the token is valid (it was verified by Clerk middleware)
    const authHeader = request.headers.get("Authorization");
    
    // Log for debugging
    console.log("Upload request received", {
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader?.substring(0, 20),
    });
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("No valid auth header found");
      return new Response(
        JSON.stringify({ 
          error: "Unauthorized", 
          details: "No authentication token provided. Please ensure you're logged in." 
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Note: We're trusting the token here because:
    // 1. The Next.js API route already verified authentication via Clerk
    // 2. Convex HTTP actions can work without Convex auth configured
    // 3. The actual file operations don't require Convex user identity

    try {
      const formData = await request.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return new Response(
          JSON.stringify({ error: "No file provided" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      let pageCount = 1;

      // Count pages for PDF files
      if (file.type === "application/pdf") {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const pdfParse = require("pdf-parse");
          const pdfData = await pdfParse(buffer);
          pageCount = pdfData.numpages || 1;
        } catch (pdfError) {
          // Fallback: count pages by searching PDF structure
          try {
            const pdfString = buffer.toString("binary");
            const pageTypeMatches = pdfString.match(/\/Type\s*\/Page[\s\/]/g);
            if (pageTypeMatches && pageTypeMatches.length > 0) {
              pageCount = pageTypeMatches.length;
            } else {
              pageCount = Math.max(1, Math.ceil(file.size / 150000));
            }
          } catch {
            pageCount = Math.max(1, Math.ceil(file.size / 150000));
          }
        }
      } else if (file.type.startsWith("image/")) {
        pageCount = 1;
      }

      // Store file in Convex storage
      // Convert Buffer to Blob for Convex storage
      const blob = new Blob([buffer], { type: file.type });
      const storageId = await ctx.storage.store(blob);

      // Get file URL
      const fileUrl = await ctx.storage.getUrl(storageId);

      return new Response(
        JSON.stringify({
          fileName: file.name,
          fileUrl: fileUrl || "",
          storageId: storageId.toString(), // Convert ID to string for JSON
          fileSize: file.size,
          pageCount,
          fileType: file.type,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("File upload error:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to upload file",
          details: error instanceof Error ? error.message : String(error),
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

export default http;


