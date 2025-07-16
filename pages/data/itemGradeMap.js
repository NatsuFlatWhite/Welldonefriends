import ItemArmor from './ItemArmor.json';
import ItemWeapon from './ItemWeapon.json';

const itemGradeMap = {};

ItemArmor.forEach(item => {
  itemGradeMap[String(item.code)] = item.itemGrade;
});

ItemWeapon.forEach(item => {
  itemGradeMap[String(item.code)] = item.itemGrade;
});

export default itemGradeMap;
