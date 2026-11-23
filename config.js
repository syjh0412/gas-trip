/* 선생님 설정 — 이 파일만 고치면 됩니다. */
window.TRIP_CONFIG = {
  // 입장 화면 맨 위에 나오는 영문 이름
  SCHOOL_EN: "GOCHEON GAS SAFE TRAVEL",
  // 구글 Apps Script 웹앱 주소. 비워 두면 학생 기기에만 저장되고, 반 전체 그래프와 교사 화면의 반 현황은 쓸 수 없습니다.
  API_URL: "https://script.google.com/macros/s/AKfycbxbvXQSs2h9tIhctngXsC4tdaWXCe8lGf3iz2iLqOJQBaazbtuyjCnONKZuI2IJFWVUMg/exec",
  // 교사 화면 비밀번호. API_URL이 비어 있을 때만 쓰입니다.
  // API_URL을 넣으면 비밀번호는 구글 스크립트(Code.gs)의 TEACHER_PIN으로 확인하므로, 이 파일에 실제 비밀번호를 적지 마세요.
  TEACHER_PIN: "0000",
  // 실시간 현황판용 접속 신호. 학생 수가 많으면 구글 시트 쓰기가 몰려 입장이 막힐 수 있어 기본은 꺼 둡니다.
  LIVE_MONITOR: false,
  // 부스 웹앱 주소. 선택한 구성 링크(…/gas-booth/?s=B2.B3.C1)를 넣으면 그 실험만 열립니다.
  BOOTH_URL: "https://syjh0412.github.io/gas-booth/",
  // 스노클 과제 주소. 여행지별로 넣으면 '여행 안내 한 줄' 단계에 버튼이 생깁니다.
  SNORKL: { T1: "", T2: "", T3: "", T4: "", T5: "", T6: "" },
  // 샤를 법칙 실험의 부피 단위 표시 (예: "mL", "눈금(칸)")
  CHARLES_UNIT: "mL",
  // 선생님 쿠폰 표시 여부. 쓰지 않으려면 false로 바꿉니다.
  COUPONS: true
};
