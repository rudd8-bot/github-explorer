export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { secret } = req.body;
  const APP_SECRET = process.env.APP_SECRET;

  if (!APP_SECRET) return res.status(500).json({ error: 'APP_SECRET 환경변수가 없습니다' });
  if (secret === APP_SECRET) return res.status(200).json({ ok: true });
  return res.status(401).json({ ok: false });
}
