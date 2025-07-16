import { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import { characterMap, modeMap, teamModeMap, tierMap } from './dataMaps.js';
import itemGradeMap from './data/itemGradeMap.js';
import CharacterSkin from './CharacterSkin.json';

const skinMap = {};
CharacterSkin.forEach(skin => {
  if (skin.weaponMountPath && skin.characterCode) {
    const parts = skin.weaponMountPath.split('/');
    if (parts.length >= 3) {
      skinMap[skin.code] = `${skin.characterCode}/${parts[2]}`; // Skin 데이터를 그대로 불러오는 거라 S000(기본 캐릭터)를 불러올 수 있는데 어차피 캐릭터 이미지가 있으니 상관 X
    }
  }
});

// 새로운 시즌 시작할 때마다 추가하면 됨 (현재 33) / 33 : 정규 시즌 8
const seasonMap = {
  0: "일반",
  ...Array.from({ length: 33 }, (_, i) => {
    const season = i + 1;
    if (season <= 18) {
      const prefix = season % 2 === 1 ? "EA 시즌" : "EA 프리 시즌";
      const number = Math.ceil(season / 2);
      return { [season]: `${prefix} ${number}` };
    } else {
      const adjusted = season - 19;
      const prefix = season % 2 === 1 ? "정규 시즌" : "프리 시즌";
      const number = Math.floor(adjusted / 2) + 1;
      return { [season]: `${prefix} ${number}` };
    }
  }).reduce((acc, cur) => ({ ...acc, ...cur }), {})
};

export default function MatchSearch() {
  const [nickname, setNickname] = useState('');
  const [season, setSeason] = useState(0);
  const [matchData, setMatchData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tier, setTier] = useState('');
  const [userInfo, setUserInfo] = useState({ nickname: '', level: 0 });
  const [nextKey, setNextKey] = useState(null);
  const [noMoreData, setNoMoreData] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (matchData.length > 0) {
      setSearching(true);
    }
  }, [matchData]);

  const fetchMatchHistory = async (reset = false) => {
    if (!nickname) return;
    setLoading(true);
    setError(null);
    if (reset) setNoMoreData(false);

    const currentNext = reset ? null : nextKey;

    try {
      const url = `/api/match-history?nickname=${encodeURIComponent(nickname)}&season=${season}` +
        (currentNext ? `&next=${currentNext}` : '');
      const response = await fetch(url, { method: "GET", cache: "no-cache" });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`${errorData.error}`);
      }

      const data = await response.json();
      if (!data || !data.userGames) throw new Error("전적 데이터가 없습니다.");

      setMatchData(prev => reset ? data.userGames : [...prev, ...data.userGames]);
      setTier(data.userTier || "Unrank");

      if (reset) {
        setUserInfo({
          nickname: data.user?.nickname || nickname,
          level: data.user?.userLevel || 0,
          mmr: data.user?.mmr || "-"
        });
      }

      const nextToken = data.next || null;
      setNextKey(nextToken);

      if (!nextToken || data.userGames.length === 0) {
        setNoMoreData(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setMatchData([]);
    setNextKey(null);
    fetchMatchHistory(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const validMatches = matchData.filter(m => {
    const mode = modeMap[m.matchingMode];
    return mode !== "코발트" && mode !== "유니온"; // 코발트 & 유니온은 계산하지 않는다.
  });

  const validGames = validMatches.length;
  const validWins = validMatches.filter(m => m.gameRank === 1).length;
  const validTeamKills = validMatches.reduce((sum, m) => sum + (m.teamKill || 0), 0);
  const validDamage = validMatches.reduce((sum, m) => sum + (m.damageToPlayer || 0), 0);
  const validAvgRank = validGames > 0 ? (validMatches.reduce((sum, m) => sum + m.gameRank, 0) / validGames).toFixed(2) : "-";
  const validAvgTK = validGames > 0 ? (validTeamKills / validGames).toFixed(2) : "0";
  const validAvgDamage = validGames > 0 ? (validDamage / validGames).toFixed(0) : "0";
  const validWinRate = validGames > 0 ? ((validWins / validGames) * 100).toFixed(1) : "0";

  const getWinRateColor = (winRate) => {
    const rate = parseFloat(winRate);
    if (rate >= 20) return "text-cyan-300";
    if (rate >= 15) return "text-green-400";
    if (rate >= 10) return "text-gray-300";
    if (rate >= 6) return "text-red-400";
    return "text-red-700";
  };

  const getDamageColor = (damage) => {
    const dmg = parseInt(damage);
    if (dmg >= 18000) return "text-cyan-300";
    if (dmg >= 14000) return "text-green-400";
    if (dmg >= 11000) return "text-gray-300";
    if (dmg >= 6000) return "text-red-400";
    return "text-red-700";
  };

  const getMostPlayedCharacter = () => {
    const counts = {};
    validMatches.forEach(m => {
      counts[m.characterNum] = (counts[m.characterNum] || 0) + 1;
    });
    const mostPlayed = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return mostPlayed ? parseInt(mostPlayed[0]) : null;
  };

  const mostPlayedChar = getMostPlayedCharacter();

  const getSkinForMostPlayed = () => {
    const mostChar = getMostPlayedCharacter();
    if (!mostChar) return null;
    const matchWithSkin = validMatches.find(m => m.characterNum === mostChar && m.skinCode && skinMap[m.skinCode]);
    return matchWithSkin?.skinCode || null;
  };

  const mostPlayedSkin = getSkinForMostPlayed();
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="p-4 max-w-2xl mx-auto text-white">
        <motion.div
          animate={{
            justifyContent: searching ? "start" : "center",
            marginTop: searching ? "1rem" : "35vh" // 검색 전 검색창 위치 관련..
          }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center"
        >
          <h1 className="text-3xl font-bold mb-2 text-center text-blue-300">메인타이틀입니다</h1>
          <h1 className="text-l font-bold mb-4 text-center text-yellow-300">이터널 리턴 전적 검색</h1>
          <div className="flex gap-2 w-full justify-center">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="닉네임 입력"
              className="flex-grow border p-3 bg-gray-800 text-white rounded-md focus:ring-2 focus:ring-blue-300 text-center"
            />
            <select
              value={season}
              onChange={(e) => setSeason(Number(e.target.value))}
              className="border p-3 bg-gray-800 text-white rounded-md focus:ring-2 focus:ring-blue-300"
            >
              {Object.entries(seasonMap).map(([key, value]) => (
                <option key={key} value={key}>{value}</option>
              ))}
            </select>
            <button
              onClick={handleSearch}
              className="bg-blue-500 text-white px-4 py-3 rounded-md hover:bg-blue-600 transition font-bold"
              disabled={loading}
            >
              {loading ? "검색 중..." : "검색"}
            </button>
          </div>
        </motion.div>

        {error && <p className="text-red-500 mt-2 text-center">오류: {error}</p>}

        // 간단한 유저 요약
        {matchData.length > 0 && (
          <div className="mt-4 p-6 border rounded-lg border-gray-500 bg-gray-900 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-xl text-blue-300">전적 요약</h2>
              <div className="flex items-center gap-2">
                <img
                  src={`/tiers/${tierMap[tier] || tierMap["0"]}`}
                  alt={tier}
                  className="w-16 h-16 object-contain"
                  onError={(e) => e.target.src = '/tiers/0.png'}
                />
                <div>
                  <p className="font-bold text-blue-300 text-lg">{tier}</p>
                  <p className="text-sm text-gray-400">{userInfo.mmr ?? 0} RP</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-6 px-4">
              <img
                src={
                  mostPlayedSkin && skinMap[mostPlayedSkin]
                    ? `/characterskin/${skinMap[mostPlayedSkin]}.png`
                    : `/characters/${mostPlayedChar}/half.png` // 스킨 데이터가 없으면 기본 이미지
                }
                alt={characterMap[mostPlayedChar] || "캐릭터"}
                className="w-36 h-51 object-cover rounded-md"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `/characters/${mostPlayedChar}/half.png`;
                }}
              />
              <div className="ml-4 flex-grow">
                <p className="text-xl font-bold text-white">{userInfo.nickname}</p>
                <p className="text-gray-400 mb-2">Lv.{userInfo.level}</p>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 bg-gray-800 rounded-lg shadow">
                    <p className="text-sm text-gray-400">승률</p>
                    <p className={`text-lg font-bold ${getWinRateColor(validWinRate)}`}>{validWinRate}%</p>
                  </div>
                  <div className="p-2 bg-gray-800 rounded-lg shadow">
                    <p className="text-sm text-gray-400">평균 TK</p>
                    <p className="text-lg font-bold text-blue-400">{validAvgTK}</p>
                  </div>
                  <div className="p-2 bg-gray-800 rounded-lg shadow">
                    <p className="text-sm text-gray-400">평균 순위</p>
                    <p className="text-lg font-bold text-yellow-400">{validAvgRank}위</p>
                  </div>
                  <div className="p-2 bg-gray-800 rounded-lg shadow">
                    <p className="text-sm text-gray-400">평균 딜량</p>
                    <p className={`text-lg font-bold ${getDamageColor(validAvgDamage)}`}>{validAvgDamage}</p>
                  </div>
                </div>
              </div>
            </div>
            // 상세 게임 데이터
            <h2 className="font-bold mt-6 text-lg text-center text-blue-300">최근 경기</h2>
            <div className="grid gap-4 mt-4">
              {matchData.map((match, index) => (
                <div key={index} className="p-4 border rounded-lg bg-gray-800 text-white flex items-center shadow-md relative overflow-hidden">
                  <img
                    src={
                      match.skinCode && skinMap[match.skinCode]
                        ? `/characterskin/${skinMap[match.skinCode]}.png`
                        : `/characters/${match.characterNum}/half.png` // 스킨 데이터가 없으면 기본 이미지
                    }
                    alt={characterMap[match.characterNum] || "캐릭터"}
                    className="w-38 h-47 object-cover rounded-md absolute left-0 top-0 bottom-10"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `/characters/${match.characterNum}/half.png`;
                    }}
                  />
                  <div className="flex-grow pl-37">
                    <p className="font-bold text-lg text-white-300">{characterMap[match.characterNum] || match.characterNum}</p>
                    <p className="text-blue-300">{modeMap[match.matchingMode]} / {teamModeMap[match.matchingTeamMode]}</p>
                    <p className="text-blue-300">TK: {match.teamKill || 0} / K: {match.playerKill || 0} / A: {match.playerAssistant || 0}</p>
                    <p className="text-yellow-400 font-bold">
                      최종 순위: {match.gameRank}위
                      <span className={`ml-2 text-sm ${getDamageColor(match.damageToPlayer || 0)}`}>
                        딜량: {match.damageToPlayer || 0}
                      </span>
                    </p>
                    {match.equipment && (
                      <div className="mt-2 grid grid-cols-6 gap-1 w-fit">
                        {[0, 1, 2, 3, 4].map(slot => {
                          const itemId = match.equipment[slot];
                          if (!itemId) {
                            return <div key={slot} className="w-12 h-8 bg-gray-700 rounded" />;
                          }
                          const grade = (itemGradeMap[itemId] || 'Common').toLowerCase();
                          return (
                            <div key={slot} className="relative w-12 h-8">
                              <img
                                src={`/items/frame/${grade}.png`}
                                alt={`${grade} 프레임`} // api 데이터에서 긁어옴
                                className="absolute top-0 left-0 w-12 h-8 z-0"
                                onError={(e) => e.target.src = '/items/frame/common.png'}
                              />
                              <img
                                src={`/items/${itemId}.png`}
                                alt={`아이템 ${itemId}`}
                                className="absolute top-0 left-0 w-12 h-8 object-contain z-10"
                                onError={(e) => e.target.src = '/items/default.png'}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  <div className="absolute right-28.5 top-30 text-right">
                    <span className="text-sm font-bold text-white-300 block">
                      {!match.routeIdOfStart ? "비공개" : match.routeIdOfStart}
                    </span>
                  <span className="text-xs font-bold text-gray-400">루트 ID</span>
                    </div>
                  </div>
                  <p className={`text-xl font-bold pr-4 ${match.gameRank === 1 ? "text-green-400" : "text-red-400"}`}>
                    {match.gameRank === 1 ? "승리" : "패배"}
                  </p>
                </div>
              ))}
            </div>
            // 더보기 버튼
            <div className="mt-6 flex flex-col items-center space-y-2">
              <button
                onClick={() => fetchMatchHistory()}
                className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 transition font-bold"
                disabled={loading || noMoreData}
              >
                {loading ? "불러오는 중..." : "더보기"}
              </button>
              {noMoreData && (
                <p className="text-gray-400 text-sm">불러올 게임이 더 이상 없습니다.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
