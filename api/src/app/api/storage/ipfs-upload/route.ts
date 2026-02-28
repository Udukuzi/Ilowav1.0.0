/**
 * IPFS Upload API
 * 
 * POST /api/storage/ipfs-upload
 * Body: FormData with file + metadata
 * Returns: { ipfsHash, url }
 */

import { NextRequest, NextResponse } from 'next/server';

const PINATA_API_KEY = process.env.PINATA_API_KEY || '';
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || '';
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

export async function POST(request: NextRequest) {
  if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Pinata not configured' },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const metadata = formData.get('metadata') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Prepare Pinata request
    const pinataFormData = new FormData();
    pinataFormData.append('file', file);

    if (metadata) {
      const parsedMetadata = JSON.parse(metadata);
      pinataFormData.append('pinataMetadata', JSON.stringify({
        name: parsedMetadata.name || file.name,
        keyvalues: {
          category: parsedMetadata.category || 'music',
          description: parsedMetadata.description || '',
          stationId: parsedMetadata.stationId || '',
          uploadedAt: Date.now().toString(),
        },
      }));
    }

    // Upload to Pinata
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET_KEY,
      },
      body: pinataFormData,
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Pinata upload failed: ${error}` },
        { status: 500 }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      ipfsHash: result.IpfsHash,
      url: `${PINATA_GATEWAY}/${result.IpfsHash}`,
      size: result.PinSize,
    });
  } catch (error) {
    console.error('IPFS upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
