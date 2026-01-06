import { NextResponse } from 'next/server';

/**
 * API route to check Clerk configuration status
 * Helps identify if development or production keys are being used
 * 
 * Usage: GET /api/check-clerk-status
 */
export async function GET() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'not-set';
  const secretKey = process.env.CLERK_SECRET_KEY ? 'set' : 'not-set';
  
  // Determine key type based on prefix
  const isProduction = publishableKey.startsWith('pk_live_');
  const isDevelopment = publishableKey.startsWith('pk_test_');
  const isValidKey = isProduction || isDevelopment;
  
  // Get key prefix for display (first 10 chars + ...)
  const keyPrefix = publishableKey.length > 10 
    ? publishableKey.substring(0, 10) + '...' 
    : publishableKey;
  
  // Determine status
  let status: 'production' | 'development' | 'unknown' | 'not-configured';
  if (!publishableKey || publishableKey === 'not-set') {
    status = 'not-configured';
  } else if (isProduction) {
    status = 'production';
  } else if (isDevelopment) {
    status = 'development';
  } else {
    status = 'unknown';
  }
  
  return NextResponse.json({
    status,
    publishableKey: {
      prefix: keyPrefix,
      isSet: publishableKey !== 'not-set',
      type: isProduction ? 'production' : isDevelopment ? 'development' : 'unknown',
    },
    secretKey: {
      isSet: secretKey === 'set',
      // Don't expose the actual secret key, just confirm it's set
    },
    environment: process.env.NODE_ENV || 'unknown',
    recommendations: getRecommendations(status, isValidKey, secretKey === 'set'),
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

function getRecommendations(
  status: string,
  isValidKey: boolean,
  secretKeySet: boolean
): string[] {
  const recommendations: string[] = [];
  
  if (status === 'not-configured') {
    recommendations.push('Clerk keys are not configured. Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to your environment variables.');
  } else if (status === 'unknown') {
    recommendations.push('Clerk publishable key format is unrecognized. Expected pk_test_... or pk_live_...');
  } else if (status === 'development') {
    recommendations.push('Using Development keys (pk_test_). For production, switch to Live keys (pk_live_) in your deployment platform.');
  } else if (status === 'production') {
    recommendations.push('Using Production keys (pk_live_). Make sure your production domain is added to Clerk allowed domains.');
  }
  
  if (!secretKeySet) {
    recommendations.push('CLERK_SECRET_KEY is not set. This is required for server-side authentication.');
  }
  
  if (status === 'production' && secretKeySet) {
    recommendations.push('✅ Production configuration looks good! Verify your domain is added in Clerk Dashboard.');
  }
  
  return recommendations;
}
