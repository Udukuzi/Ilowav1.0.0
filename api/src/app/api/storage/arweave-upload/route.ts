/**
 * Arweave Upload API
 * 
 * POST /api/storage/arweave-upload
 * Body: FormData with file + metadata
 * Returns: { transactionId, url }
 * 
 * Note: Arweave requires a funded wallet for uploads.
 * Cost: ~$8/GB (one-time, permanent storage)
 */

import { NextRequest, NextResponse } from 'next/server';

// In production, use arweave-js with a funded wallet
// import Arweave from 'arweave';

const ARWEAVE_GATEWAY = 'https://arweave.net';

export async function POST(request: NextRequest) {
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

    // Parse metadata
    let parsedMetadata = { name: file.name, category: 'podcast' };
    if (metadata) {
      parsedMetadata = JSON.parse(metadata);
    }

    // In production:
    // const arweave = Arweave.init({ host: 'arweave.net', port: 443, protocol: 'https' });
    // const wallet = JSON.parse(process.env.ARWEAVE_WALLET_JWK || '{}');
    // const data = await file.arrayBuffer();
    // const transaction = await arweave.createTransaction({ data: Buffer.from(data) }, wallet);
    // transaction.addTag('Content-Type', file.type);
    // transaction.addTag('App-Name', 'Ilowa');
    // transaction.addTag('Category', parsedMetadata.category);
    // await arweave.transactions.sign(transaction, wallet);
    // const response = await arweave.transactions.post(transaction);
    // const transactionId = transaction.id;

    // For now, return a placeholder response
    return NextResponse.json({
      success: false,
      error: 'Arweave wallet not configured. Add ARWEAVE_WALLET_JWK to environment.',
      instructions: [
        '1. Create Arweave wallet at https://arweave.app',
        '2. Fund wallet with AR tokens',
        '3. Export wallet JWK and add to .env as ARWEAVE_WALLET_JWK',
      ],
    }, { status: 503 });
  } catch (error) {
    console.error('Arweave upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
