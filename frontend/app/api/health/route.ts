// =============================================
// Health Check API Route
// =============================================
// Used by AWS App Service / Azure App Service for health monitoring

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Disable caching for health checks

/**
 * GET /api/health
 * Returns health status of the frontend application
 */
export async function GET() {
  try {
    const healthData = {
      status: 'ok',
      service: 'quickverdicts-frontend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',

      // Check critical environment variables
      config: {
        apiUrl: process.env.NEXT_PUBLIC_API_URL ? 'configured' : 'missing',
        frontendUrl: process.env.NEXT_PUBLIC_FRONTEND_URL ? 'configured' : 'missing',
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL ? 'configured' : 'missing',
      },

      // Memory usage
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
    };

    return NextResponse.json(healthData, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Health check error:', error);

    return NextResponse.json(
      {
        status: 'error',
        service: 'quickverdicts-frontend',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
