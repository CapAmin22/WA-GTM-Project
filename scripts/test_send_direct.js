const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/dashboard/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TARGET_NUMBERS = [
    '917367963949@s.whatsapp.net',
    '919944436924@s.whatsapp.net',
    '918318260090@s.whatsapp.net'
];

async function testSend() {
    console.log('Fetching account ID for Passionbits (+918329556730)...');
    const { data: acc, error } = await supabase
        .from('wa_accounts')
        .select('id')
        .eq('phone_number', '+918329556730')
        .single();
    
    if (error || !acc) {
        console.error('Failed to grab account:', error);
        process.exit(1);
    }

    console.log(`Found account ID: ${acc.id}`);
    const authDir = path.resolve(`./auth_info_${acc.id}`);
    console.log(`Loading session from ${authDir}...`);

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'info' })),
        },
        logger: pino({ level: 'info' }),
        printQRInTerminal: true,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log('✅ Connected to WhatsApp!');
            
            for (const jid of TARGET_NUMBERS) {
                console.log(`Sending message to ${jid}...`);
                try {
                    // Send presence first (Stealth)
                    await sock.sendPresenceUpdate('composing', jid);
                    await new Promise(r => setTimeout(r, 2000));
                    await sock.sendPresenceUpdate('paused', jid);

                    // Send text
                    await sock.sendMessage(jid, { text: 'Hi this is Passionbits' });
                    console.log(`✅ Sent successfully to ${jid}`);
                    
                    // Delay between messages
                    await new Promise(r => setTimeout(r, 3000));
                } catch (err) {
                    console.error(`❌ Failed to send to ${jid}:`, err.message);
                }
            }

            console.log('Done! Closing socket...');
            sock.end();
            process.exit(0);
        }
    });
}

testSend().catch(console.error);
