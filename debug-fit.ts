/**
 * Debug script to see FIT file structure
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { Decoder, Stream } from '@garmin/fitsdk';
import { gunzipSync } from 'zlib';

async function debugFit() {
  const fitPath = join(
    __dirname,
    'docs/sample_data/zwift-activity-2016248599700062240.fit.gz',
  );

  const buffer = readFileSync(fitPath);

  // Decompress
  const decompressed = buffer[0] === 0x1f && buffer[1] === 0x8b ? gunzipSync(buffer) : buffer;

  // Decode
  const stream = Stream.fromBuffer(decompressed);
  const decoder = new Decoder(stream);

  if (!decoder.isFIT()) {
    console.log('Not a valid FIT file');
    return;
  }

  const { messages, errors } = decoder.read();

  console.log('\n📦 FIT File Contents:\n');
  console.log('Message types found:');
  console.log(Object.keys(messages));

  console.log('\n\n📋 All message types with counts:');
  for (const [key, value] of Object.entries(messages)) {
    if (Array.isArray(value)) {
      console.log(`  ${key}: ${value.length} messages`);
    }
  }

  console.log('\n\n🔍 Sample Record Message:');
  if (messages.recordMesgs && messages.recordMesgs.length > 0) {
    console.log(JSON.stringify(messages.recordMesgs[0], null, 2));
  }

  console.log('\n\n🔍 Session Message:');
  if (messages.sessionMesgs && messages.sessionMesgs.length > 0) {
    console.log(JSON.stringify(messages.sessionMesgs[0], null, 2));
  }

  console.log('\n\n🔍 Lap Messages:');
  if (messages.lapMesgs && messages.lapMesgs.length > 0) {
    console.log(JSON.stringify(messages.lapMesgs[0], null, 2));
  }
}

debugFit().catch(console.error);
