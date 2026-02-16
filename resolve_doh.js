const https = require('https');

function resolve(name, type) {
  return new Promise((resolve, reject) => {
    https.get(`https://dns.google/resolve?name=${name}&type=${type}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    console.log('--- Checking TXT for Replica Set Name ---');
    const txt = await resolve('cluster0.wwpyz6y.mongodb.net', 'TXT');
    if (txt.Answer) {
      console.log('TXT Records:', JSON.stringify(txt.Answer, null, 2));
    } else {
        console.log('No TXT records found via DoH.');
    }

    const shards = [
        'ac-wuyemwq-shard-00-00.wwpyz6y.mongodb.net',
        'ac-wuyemwq-shard-00-01.wwpyz6y.mongodb.net',
        'ac-wuyemwq-shard-00-02.wwpyz6y.mongodb.net'
    ];

    console.log('--- Checking A records for candidates ---');
    for (const shard of shards) {
        // console.log(`Checking ${shard}...`);
        const a = await resolve(shard, 'A');
        if (a.Answer) {
            console.log(`Match for ${shard}:`);
            for (const rec of a.Answer) {
                if (rec.type === 1) console.log(`  IP: ${rec.data}`);
            }
        } else {
            console.log(`No A record for ${shard}`);
        }
    }

  } catch (err) {
    console.error('DoH Error:', err);
  }
}

main();
