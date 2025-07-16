// skinMap.js
import CharacterSkin from './CharacterSkin.json';

const skinMap = {};
CharacterSkin.forEach(skin => {
  if (skin.weaponMountPath) {
    const parts = skin.weaponMountPath.split('/');
    if (parts.length >= 3) {
      skinMap[skin.code] = `${parts[1]}/${parts[2]}`; // 중요 부분만 긁어오기 / 예시: "Jackie/S001"
    }
  }
});

export default skinMap;
