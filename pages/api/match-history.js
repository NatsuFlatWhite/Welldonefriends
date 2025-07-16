export default async function handler(req, res) {
 res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

 const { nickname, season, next } = req.query;

 if (!nickname) {
  return res.status(400).json({ error: "닉네임을 입력해주세요." });
 }

 try {
  const API_KEY = process.env.ER_API_KEY;

  const userRes = await fetch(`https://open-api.bser.io/v1/user/nickname?query=${encodeURIComponent(nickname)}`, {
   headers: { "x-api-key": API_KEY },
  });

  if (!userRes.ok) throw new Error("유저 정보를 가져오지 못함");

  const userData = await userRes.json();
  const userNum = userData?.user?.userNum;
  if (!userNum) throw new Error("해당 유저는 존재하지 않는 유저입니다.");

  const rankRes = await fetch(`https://open-api.bser.io/v1/user/stats/${userNum}/${season}`, {
   headers: { "x-api-key": API_KEY },
  });

  let mmr = 0;
  if (rankRes.ok) {
   const rankData = await rankRes.json();
   const mmrData = rankData.userStats?.find((stat) => stat.seasonId === Number(season));
   if (mmrData) {
    mmr = mmrData.mmr || 0;
   }
  }

  const topRankRes = await fetch(`https://open-api.bser.io/v1/rank/top/${season}`, {
   headers: { "x-api-key": API_KEY },
  });

  // 데미 이터 상위 평균 값 지정
  let demigodMMR = 8500;
  let eternityMMR = 8954;

  if (topRankRes.ok) {
   const topRankData = await topRankRes.json();
   const topPlayers = topRankData.topRanks || [];
   if (topPlayers.length >= 1000) demigodMMR = topPlayers[999].mmr;
   if (topPlayers.length >= 300) eternityMMR = topPlayers[299].mmr;
  }

  // 티어 값 지정 (MMR 수치)
  const tierRanges = [
   { name: "아이언 IV", min: 1, max: 149 },
   { name: "아이언 III", min: 150, max: 299 },
   { name: "아이언 II", min: 300, max: 449 },
   { name: "아이언 I", min: 450, max: 559 },
   { name: "브론즈 IV", min: 600, max: 799 },
   { name: "브론즈 III", min: 800, max: 999 },
   { name: "브론즈 II", min: 1000, max: 1199 },
   { name: "브론즈 I", min: 1200, max: 1399 },
   { name: "실버 IV", min: 1400, max: 1649 },
   { name: "실버 III", min: 1650, max: 1899 },
   { name: "실버 II", min: 1900, max: 2149 },
   { name: "실버 I", min: 2150, max: 2399 },
   { name: "골드 IV", min: 2400, max: 2699 },
   { name: "골드 III", min: 2700, max: 2999 },
   { name: "골드 II", min: 3000, max: 3299 },
   { name: "골드 I", min: 3300, max: 3599 },
   { name: "플래티넘 IV", min: 3600, max: 3949 },
   { name: "플래티넘 III", min: 3950, max: 4299 },
   { name: "플래티넘 II", min: 4300, max: 4649 },
   { name: "플래티넘 I", min: 4650, max: 4999 },
   { name: "다이아몬드 IV", min: 5000, max: 5349 },
   { name: "다이아몬드 III", min: 5350, max: 5699 },
   { name: "다이아몬드 II", min: 5700, max: 6049 },
   { name: "다이아몬드 I", min: 6050, max: 6399 },
   { name: "메테오라이트", min: 6400, max: 7099 },
   { name: "미스릴", min: 7100, max: 8800 },
  ];

  let userTier = tierRanges.find((tier) => mmr >= tier.min && mmr <= tier.max)?.name || "언랭크";
  if (mmr >= demigodMMR) userTier = "데미갓";
  if (mmr >= eternityMMR) userTier = "이터니티";

  let allUserGames = [];
  let currentNext = req.query.next || null;
  let finalNextKey = null;


  // 20 게임을 불러오게 for 반복문으로 2번 리퀘스트를 보내서 10 + 10으로 꼼수 ㅋㅋ
  for (let i = 0; i < 2; i++) {
   let matchUrl = `https://open-api.bser.io/v1/user/games/${userNum}?seasonId=${season}`;
   if (currentNext) {
    matchUrl += `&next=${currentNext}`;
   }
   matchUrl += `&_=${Date.now()}`;

   const matchRes = await fetch(matchUrl, {
    headers: { "x-api-key": API_KEY },
   });

   if (!matchRes.ok) {
    if (i === 0) throw new Error("전적 데이터를 가져오지 못함");
    break;
   }

   // 더보기 버튼
   const matchData = await matchRes.json();
   const fetchedGames = matchData?.userGames || [];
   allUserGames.push(...fetchedGames);
   
   if (matchData.next) {
    currentNext = matchData.next;
    finalNextKey = matchData.next;
   } else {
    finalNextKey = null;
    break;
   }
  }

  //.filter(game => season === "0" || (game.matchingMode === 3 && game.seasonId === Number(season))) //만약 90일 제한이 없었다면 사용 했을 코드
  //이잔 게임 기록을 불러오지 못하는 문제가 있음 (최대 90일 까지의 게임 기록을 저장) 그로 인해 이전 시즌 검색(랭크전만 나오게)는 정규 시즌 7부터만 지원
  const userGames = allUserGames
   .filter(game => {
    const seasonNum = Number(season);
    if (seasonNum === 0 || seasonNum <= 30) {
     return true;
    }
    return game.matchingMode === 3 && game.seasonId === seasonNum;
   })
   .map(game => ({
    ...game,
    equipment: game.equipment || [],
   }));

  let userLevel = 0;

  if (userGames.length > 0) {
   const firstGameId = userGames[0].gameId;
   const gameDetailRes = await fetch(`https://open-api.bser.io/v1/games/${firstGameId}`, {
    headers: { "x-api-key": API_KEY },
   });

   if (gameDetailRes.ok) {
    const gameDetail = await gameDetailRes.json();
    const player = gameDetail?.userGames?.find((p) => p.userNum === userNum);
    if (player) {
     userLevel = player.accountLevel || 0;
    }
   }
  }

  return res.status(200).json({
   userGames,
   next: finalNextKey,
   userTier,
   user: { nickname, userLevel, mmr },
  });
 } catch (error) {
  console.error("API 오류:", error.message);
  return res.status(500).json({ error: error.message });
 }
}