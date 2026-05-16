export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { keywords } = req.body;
  const pat = process.env.GITHUB_PAT;

  if (!pat) return res.status(500).json({ error: 'GITHUB_PAT 환경변수가 없습니다' });
  if (!keywords || !keywords.length) return res.status(400).json({ error: 'keywords가 없습니다' });

  try {
    // 키워드를 조합해 검색 쿼리 생성
    const query = keywords.slice(0, 3).join(' ') + ' stars:>50';

    const response = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=20`,
      {
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'github-explorer'
        }
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'GitHub API 오류');
    }

    const data = await response.json();

    // 최근 6개월 내 업데이트된 것만 필터
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const repos = data.items
      .filter(r => new Date(r.pushed_at) > sixMonthsAgo)
      .slice(0, 15)
      .map(r => ({
        full_name: r.full_name,
        url: r.html_url,
        stars: r.stargazers_count,
        language: r.language,
        description: r.description,
        updated: new Date(r.pushed_at).toISOString().split('T')[0],
        readme_snippet: null // Tavily가 채워줌
      }));

    return res.status(200).json({ repos });

  } catch (err) {
    console.error('GitHub API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
