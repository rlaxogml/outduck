const url = 'https://dcjnmis8jxmbl.cloudfront.net/upload/image/post/content/2026/06/12/CzPG9RsyMONUZTc0.webp';

async function checkUrl() {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://chzzk.naver.com/', // or maybe just a generic referer
      }
    });
    console.log('Status with Referer/UA:', res.status);
  } catch (err) {
    console.error('Error fetching url:', err);
  }
}

checkUrl();
