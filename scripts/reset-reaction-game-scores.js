#!/usr/bin/env node
/**
 * 반응속도 게임 스코어 리셋 스크립트
 * 관리자가 사용자들의 반응속도 게임 기록을 초기화할 때 사용
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../shared/credentials/inschoolz-firebase-adminsdk-p6trg-c275cfa0f4.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://inschoolz-default-rtdb.firebaseio.com'
});

const db = admin.firestore();

async function resetReactionGameScores(userId = null) {
  try {
    if (userId) {
      // 특정 사용자만 리셋
      console.log(`🔄 사용자 ${userId}의 반응속도 게임 기록 리셋 중...`);
      
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        console.error(`❌ 사용자 ${userId}를 찾을 수 없습니다.`);
        return false;
      }
      
      const userData = userDoc.data();
      console.log(`👤 사용자: ${userData?.profile?.userName || '이름 없음'}`);
      
      // 현재 기록 확인
      const currentRecord = userData.gameStats?.reactionGame?.bestReactionTime;
      if (currentRecord) {
        console.log(`📊 현재 최고 기록: ${currentRecord}ms`);
      } else {
        console.log(`📊 기존 기록이 없습니다.`);
      }
      
      // 리셋 실행
      await userRef.update({
        'gameStats.reactionGame': admin.firestore.FieldValue.delete(),
        'activityLimits.dailyCounts.games.reactionGame': 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✅ 사용자 ${userId}의 반응속도 게임 기록이 리셋되었습니다.`);
      return true;
    } else {
      // 모든 사용자 리셋
      console.log('🔄 모든 사용자의 반응속도 게임 기록 리셋 중...');
      
      const snapshot = await db.collection('users').get();
      console.log(`👥 총 ${snapshot.size}명의 사용자 발견`);
      
      // 기존 기록이 있는 사용자 확인
      let usersWithRecords = 0;
      snapshot.docs.forEach(doc => {
        const userData = doc.data();
        if (userData.gameStats?.reactionGame?.bestReactionTime) {
          usersWithRecords++;
        }
      });
      
      console.log(`📊 반응속도 게임 기록이 있는 사용자: ${usersWithRecords}명`);
      
      if (usersWithRecords === 0) {
        console.log('📭 리셋할 기록이 없습니다.');
        return true;
      }
      
      // 배치 업데이트로 모든 사용자 리셋
      const batch = db.batch();
      
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          'gameStats.reactionGame': admin.firestore.FieldValue.delete(),
          'activityLimits.dailyCounts.games.reactionGame': 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      
      await batch.commit();
      console.log(`✅ 모든 사용자 (${snapshot.size}명)의 반응속도 게임 기록이 리셋되었습니다.`);
      return true;
    }
  } catch (error) {
    console.error('❌ 반응속도 게임 스코어 리셋 실패:', error);
    return false;
  }
}

async function listReactionGameStats() {
  try {
    console.log('📊 반응속도 게임 통계 조회 중...\n');
    
    const usersSnapshot = await db.collection('users')
      .where('gameStats.reactionGame.bestReactionTime', '>', 0)
      .orderBy('gameStats.reactionGame.bestReactionTime', 'asc')
      .get();
    
    if (usersSnapshot.empty) {
      console.log('📭 반응속도 게임 기록이 있는 사용자가 없습니다.');
      return;
    }
    
    console.log(`🏆 반응속도 게임 랭킹 (총 ${usersSnapshot.size}명):\n`);
    
    usersSnapshot.docs.forEach((doc, index) => {
      const userData = doc.data();
      const bestTime = userData.gameStats?.reactionGame?.bestReactionTime;
      const userName = userData.profile?.userName || '익명';
      const schoolName = userData.school?.name || '학교 미설정';
      
      console.log(`${index + 1}. ${userName} (${schoolName})`);
      console.log(`   최고 기록: ${bestTime}ms (${(bestTime / 1000).toFixed(3)}초)`);
      console.log(`   사용자 ID: ${doc.id}\n`);
    });
  } catch (error) {
    console.error('❌ 반응속도 게임 통계 조회 실패:', error);
  }
}

// 메인 실행 함수
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🎮 반응속도 게임 스코어 관리 스크립트');
    console.log('=' .repeat(50));
    console.log('');
    console.log('사용법:');
    console.log('  node reset-reaction-game-scores.js stats                    # 현재 랭킹 조회');
    console.log('  node reset-reaction-game-scores.js reset [USER_ID]         # 특정 사용자 기록 리셋');
    console.log('  node reset-reaction-game-scores.js reset-all               # 모든 사용자 기록 리셋');
    console.log('');
    console.log('예시:');
    console.log('  node reset-reaction-game-scores.js stats');
    console.log('  node reset-reaction-game-scores.js reset kgfWa3onhhCBh2sLxiUWw19JWR2');
    console.log('  node reset-reaction-game-scores.js reset-all');
    console.log('');
    console.log('⚠️  주의: reset-all 명령은 모든 사용자의 기록을 삭제합니다!');
    return;
  }
  
  const command = args[0];
  
  if (command === 'stats') {
    await listReactionGameStats();
  } else if (command === 'reset') {
    const userId = args[1];
    
    if (!userId) {
      console.error('❌ 사용자 ID를 입력해주세요.');
      console.log('사용법: node reset-reaction-game-scores.js reset [USER_ID]');
      return;
    }
    
    const success = await resetReactionGameScores(userId);
    if (!success) {
      process.exit(1);
    }
  } else if (command === 'reset-all') {
    console.log('⚠️  경고: 모든 사용자의 반응속도 게임 기록을 삭제합니다!');
    console.log('이 작업은 되돌릴 수 없습니다.');
    console.log('');
    
    // 확인 없이 바로 실행 (스크립트이므로)
    const success = await resetReactionGameScores();
    if (!success) {
      process.exit(1);
    }
  } else {
    console.error('❌ 알 수 없는 명령어:', command);
    console.log('사용 가능한 명령어: stats, reset, reset-all');
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

module.exports = { resetReactionGameScores, listReactionGameStats };