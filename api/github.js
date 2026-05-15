export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-secret');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // APP_SECRET 검증
  const secret = req.headers['x-app-secret'];
  if (!secret || secret !== process.env.APP_SECRET) {
    return res.status(403).json({ error: '접근 권한이 없습니다.' });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const { type, query, owner, repo } = req.body || {};

  const headers = {
    'Accept': 'application/vnd.github+json',
    ...(githubToken ? { 'Authorization': `token ${githubToken}` } : {}),
  };

  try {
    if (type === 'search') {
      const res2 = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=5`,
        { headers }
      );
      const data = await res2.json();
      return res.status(200).json(data);
    }

    if (type === 'readme') {
      const res2 = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/readme`,
        { headers }
      );
      const data = await res2.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: '알 수 없는 type' });
  } catch (err) {
    return res.status(500).json({ error: 'GitHub API 오류', detail: err.message });
  }
}
