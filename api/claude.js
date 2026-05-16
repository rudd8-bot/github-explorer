export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { task, problem, stack, repos, rest_repos, keywords } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY 환경변수가 없습니다' });

  try {
    if (task === 'extract_keywords') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: `너는 GitHub 검색 키워드 추출 전문가다.
사용자의 문제 설명에서 GitHub 검색에 효과적인 영어 키워드를 추출해라.
반드시 JSON 배열로만 응답해. 다른 텍스트 없이 JSON만.
형식: ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
키워드는 3~5개, 영어로, 구체적이고 기술적인 용어 우선.`,
          messages: [{ role: 'user', content: `문제: ${problem}\n내 스택: ${stack}` }]
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Claude API 오류');

      const text = data.content[0].text.trim();
      const clean = text.replace(/```json|```/g, '').trim();
      const kws = JSON.parse(clean);
      return res.status(200).json({ keywords: kws });

    } else if (task === 'judge_repos') {
      const repoList = repos.map((r, i) => `
[${i+1}] ${r.full_name}
Stars: ${r.stars} | Language: ${r.language || '없음'} | Updated: ${r.updated}
Description: ${r.description || '없음'}
README: ${r.readme_content ? r.readme_content.slice(0, 800) : r.readme_snippet || '없음'}
`).join('\n---\n');

      const restList = (rest_repos || []).map(r => `
${r.full_name} (★${r.stars}, ${r.language || '?'})
${r.description || ''}
`).join('\n');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          system: `너는 GitHub 레포 실행 가능성 판단 전문가다.
각 레포에 대해 3단계 판단을 수행하고 반드시 JSON으로만 응답해.
다른 텍스트 없이 JSON 배열만.

판단 기준:
- verdict1 (유형 존재): "있음" / "유사 있음" / "없음"
- verdict2 (활용 가능): "가능" / "수정 필요" / "불가"  
- verdict3 (내 스택 적용): "가능" / "부분 가능" / "불가"
- summary: 한 줄 요약 (한국어, 30자 이내)
- readme_snippet: README에서 가장 핵심적인 문장 1~2개 (없으면 null)

형식:
[
  {
    "full_name": "owner/repo",
    "url": "https://github.com/owner/repo",
    "stars": 숫자,
    "language": "언어",
    "updated": "날짜",
    "description": "설명",
    "verdict1": "있음",
    "verdict2": "가능",
    "verdict3": "부분 가능",
    "summary": "요약",
    "readme_snippet": "핵심 문장"
  }
]`,
          messages: [{
            role: 'user',
            content: `내 문제: ${problem}
내 스택: ${stack}

=== 상위 5개 레포 (README 포함) ===
${repoList}

${restList ? `=== 나머지 레포 (간략) ===\n${restList}` : ''}

위 레포들에 대해 3단계 판단을 수행해줘.
상위 5개는 상세히, 나머지는 기본 정보만으로 판단해서
전체를 하나의 JSON 배열로 반환해줘.`
          }]
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Claude API 오류');

      const text = data.content[0].text.trim();
      const clean = text.replace(/```json|```/g, '').trim();
      const results = JSON.parse(clean);
      return res.status(200).json({ results });
    }

    return res.status(400).json({ error: '알 수 없는 task' });

  } catch (err) {
    console.error('Claude API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
