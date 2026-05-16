export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { repos } = req.body;
  const tavilyKey = process.env.TAVILY_API_KEY;

  if (!tavilyKey) return res.status(500).json({ error: 'TAVILY_API_KEY 환경변수가 없습니다' });
  if (!repos || !repos.length) return res.status(400).json({ error: 'repos가 없습니다' });

  try {
    // 상위 5개만 Tavily로 README 수집 (비용 절감)
    const top5 = repos.slice(0, 5);

    const enriched = await Promise.all(top5.map(async (repo) => {
      try {
        // GitHub README URL로 Tavily 검색
        const readmeUrl = `https://raw.githubusercontent.com/${repo.full_name}/main/README.md`;
        const fallbackUrl = `https://raw.githubusercontent.com/${repo.full_name}/master/README.md`;

        const response = await fetch('https://api.tavily.com/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            urls: [readmeUrl, fallbackUrl],
            include_raw_content: false
          })
        });

        if (!response.ok) {
          return { ...repo, readme_content: null };
        }

        const data = await response.json();
        const content = data.results?.[0]?.raw_content || data.results?.[0]?.content ||
                        data.results?.[1]?.raw_content || data.results?.[1]?.content || null;

        return {
          ...repo,
          readme_content: content ? content.slice(0, 1500) : null
        };

      } catch (e) {
        // Tavily 실패 시 해당 레포만 스킵
        return { ...repo, readme_content: null };
      }
    }));

    return res.status(200).json({ enriched });

  } catch (err) {
    console.error('Tavily error:', err);
    return res.status(500).json({ error: err.message });
  }
}
