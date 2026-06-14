const http = require('http');

http.get('http://localhost:3000/lck_msi.png', (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
}).on('error', (e) => {
  console.error(`Got error: ${e.message}`);
});
