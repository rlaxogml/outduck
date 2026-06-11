const getWeekDates = (baseDate) => {
  const dates = [];
  const day = baseDate.getDay(); // 0 = Sun
  
  if (day === 0) {
    for (let i = 1; i <= 6; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      dates.push(d);
    }
    dates.push(new Date(baseDate));
    return dates;
  }

  const diff = baseDate.getDate() - day + 1; 
  for (let i = 0; i < 7; i++) {
    const d = new Date(baseDate);
    d.setDate(diff + i);
    dates.push(d);
  }
  return dates;
};

function getWeekRange() {
  const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  console.log('todayStr in Seoul:', todayStr);
  const [year, month, day] = todayStr.split("-").map(Number);
  const baseDate = new Date(year, month - 1, day);
  
  const weekDates = getWeekDates(baseDate);
  const sorted = [...weekDates].sort((a, b) => a.getTime() - b.getTime());
  const weekStart = sorted[0].toLocaleDateString("sv-SE");
  const weekEnd = sorted[6].toLocaleDateString("sv-SE");
  
  console.log('Week Start:', weekStart);
  console.log('Week End:', weekEnd);
  return { weekStart, weekEnd };
}

getWeekRange();
