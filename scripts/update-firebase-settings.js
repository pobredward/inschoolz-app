#!/usr/bin/env node
/**
 * Firebase 시스템 설정 업데이트 스크립트
 * 게임 설정, 경험치 설정, 출석 보너스 등을 관리
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../shared/credentials/inschoolz-firebase-adminsdk-p6trg-c275cfa0f4.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://inschoolz-default-rtdb.firebaseio.com'
});

const db = admin.firestore();

// 기본 설정 템플릿
const defaultSettings = {
  games: {
    reactionGame: {
      enabled: true,
      dailyLimit: 5,
      thresholds: [
        { minReactionTime: 100, xpReward: 25 },
        { minReactionTime: 200, xpReward: 20 },
        { minReactionTime: 300, xpReward: 15 },
        { minReactionTime: 500, xpReward: 10 },
        { minReactionTime: 1000, xpReward: 5 }
      ]
    },
    tileGame: {
      enabled: true,
      dailyLimit: 3,
      thresholds: [
        { minMoves: 7, xpReward: 25 },
        { minMoves: 10, xpReward: 20 },
        { minMoves: 13, xpReward: 15 },
        { minMoves: 16, xpReward: 10 },
        { minMoves: 20, xpReward: 5 }
      ]
    }
  },
  attendance: {
    weeklyBonusXP: 50,
    streakBonus: 5,
    maxStreakDays: 30
  },
  posts: {
    dailyLimit: 10,
    xpReward: 10
  },
  comments: {
    dailyLimit: 20,
    xpReward: 5
  },
  levelSystem: {
    baseXP: 100,
    multiplier: 1.5
  }
};

async function getCurrentSettings() {
  try {
    console.log('📖 현재 Firebase 설정 조회 중...\n');
    
    const settingsDoc = await db.collection('system').doc('experienceSettings').get();
    
    if (!settingsDoc.exists) {
      console.log('📭 설정 문서가 없습니다. 기본 설정을 생성해야 합니다.');
      return null;
    }
    
    const settings = settingsDoc.data();
    console.log('🔧 현재 설정:');
    console.log(JSON.stringify(settings, null, 2));
    console.log('');
    
    return settings;
  } catch (error) {
    console.error('❌ 설정 조회 실패:', error);
    return null;
  }
}

async function updateFirebaseSettings(settingsPath, newValue) {
  try {
    console.log(`🔄 설정 업데이트 중: ${settingsPath}`);
    console.log('새 값:', JSON.stringify(newValue, null, 2));
    
    const settingsRef = db.collection('system').doc('experienceSettings');
    
    // 설정 경로를 점 표기법으로 변환
    const updateData = {
      [settingsPath]: newValue,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await settingsRef.update(updateData);
    
    console.log(`✅ ${settingsPath} 설정이 업데이트되었습니다.`);
    return true;
  } catch (error) {
    console.error('❌ Firebase 설정 업데이트 실패:', error);
    return false;
  }
}

async function createDefaultSettings() {
  try {
    console.log('🔄 기본 설정 생성 중...');
    
    const settingsRef = db.collection('system').doc('experienceSettings');
    
    await settingsRef.set({
      ...defaultSettings,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ 기본 설정이 생성되었습니다.');
    console.log('📋 생성된 설정:');
    console.log(JSON.stringify(defaultSettings, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ 기본 설정 생성 실패:', error);
    return false;
  }
}

async function updateGameSettings(gameType, settings) {
  try {
    const validGames = ['reactionGame', 'tileGame'];
    if (!validGames.includes(gameType)) {
      console.error(`❌ 유효하지 않은 게임 타입: ${gameType}`);
      console.log(`사용 가능한 게임: ${validGames.join(', ')}`);
      return false;
    }
    
    return await updateFirebaseSettings(`games.${gameType}`, settings);
  } catch (error) {
    console.error('❌ 게임 설정 업데이트 실패:', error);
    return false;
  }
}

async function updateAttendanceSettings(settings) {
  try {
    return await updateFirebaseSettings('attendance', settings);
  } catch (error) {
    console.error('❌ 출석 설정 업데이트 실패:', error);
    return false;
  }
}

async function resetToDefaults() {
  try {
    console.log('⚠️  모든 설정을 기본값으로 리셋합니다...');
    
    const settingsRef = db.collection('system').doc('experienceSettings');
    
    await settingsRef.set({
      ...defaultSettings,
      resetAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ 모든 설정이 기본값으로 리셋되었습니다.');
    return true;
  } catch (error) {
    console.error('❌ 설정 리셋 실패:', error);
    return false;
  }
}

// 메인 실행 함수
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('⚙️  Firebase 시스템 설정 관리 스크립트');
    console.log('=' .repeat(50));
    console.log('');
    console.log('사용법:');
    console.log('  node update-firebase-settings.js show                      # 현재 설정 조회');
    console.log('  node update-firebase-settings.js init                      # 기본 설정 생성');
    console.log('  node update-firebase-settings.js reset                     # 모든 설정을 기본값으로 리셋');
    console.log('  node update-firebase-settings.js game [TYPE] [JSON]        # 게임 설정 업데이트');
    console.log('  node update-firebase-settings.js attendance [JSON]         # 출석 설정 업데이트');
    console.log('');
    console.log('예시:');
    console.log('  node update-firebase-settings.js show');
    console.log('  node update-firebase-settings.js init');
    console.log('  node update-firebase-settings.js game reactionGame \'{"enabled":true,"dailyLimit":10}\'');
    console.log('  node update-firebase-settings.js attendance \'{"weeklyBonusXP":100,"streakBonus":10}\'');
    console.log('');
    console.log('게임 타입: reactionGame, tileGame');
    return;
  }
  
  const command = args[0];
  
  try {
    if (command === 'show') {
      await getCurrentSettings();
    } 
    else if (command === 'init') {
      const success = await createDefaultSettings();
      if (!success) process.exit(1);
    }
    else if (command === 'reset') {
      const success = await resetToDefaults();
      if (!success) process.exit(1);
    }
    else if (command === 'game') {
      const gameType = args[1];
      const settingsJson = args[2];
      
      if (!gameType || !settingsJson) {
        console.error('❌ 게임 타입과 설정 JSON을 모두 입력해주세요.');
        console.log('사용법: node update-firebase-settings.js game [TYPE] [JSON]');
        process.exit(1);
      }
      
      try {
        const settings = JSON.parse(settingsJson);
        const success = await updateGameSettings(gameType, settings);
        if (!success) process.exit(1);
      } catch (error) {
        console.error('❌ JSON 파싱 오류:', error);
        console.log('올바른 JSON 형식으로 입력해주세요.');
        process.exit(1);
      }
    }
    else if (command === 'attendance') {
      const settingsJson = args[1];
      
      if (!settingsJson) {
        console.error('❌ 출석 설정 JSON을 입력해주세요.');
        console.log('사용법: node update-firebase-settings.js attendance [JSON]');
        process.exit(1);
      }
      
      try {
        const settings = JSON.parse(settingsJson);
        const success = await updateAttendanceSettings(settings);
        if (!success) process.exit(1);
      } catch (error) {
        console.error('❌ JSON 파싱 오류:', error);
        console.log('올바른 JSON 형식으로 입력해주세요.');
        process.exit(1);
      }
    }
    else {
      console.error('❌ 알 수 없는 명령어:', command);
      console.log('사용 가능한 명령어: show, init, reset, game, attendance');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 명령 실행 오류:', error);
    process.exit(1);
  }
  
  // Firebase 연결 종료
  admin.app().delete();
}

// 스크립트 실행
if (require.main === module) {
  main().catch((error) => {
    console.error('스크립트 실행 오류:', error);
    process.exit(1);
  });
}

module.exports = { 
  getCurrentSettings, 
  updateFirebaseSettings, 
  createDefaultSettings, 
  updateGameSettings, 
  updateAttendanceSettings, 
  resetToDefaults 
};