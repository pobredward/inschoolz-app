/**
 * 개선된 푸시 알림 시스템 테스트 스크립트
 * 사용법: node test-improved-notifications.js [USER_ID]
 */

const admin = require('firebase-admin');
const path = require('path');

// Firebase Admin 초기화
const serviceAccount = require('../../shared/credentials/inschoolz-firebase-adminsdk-p6trg-c275cfa0f4.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://inschoolz-default-rtdb.asia-southeast1.firebasedatabase.app'
  });
}

const db = admin.firestore();

// 개선된 알림 템플릿 테스트
const IMPROVED_NOTIFICATION_TESTS = [
  {
    name: '게시글 댓글 알림 (일반 사용자)',
    type: 'post_comment',
    title: '💬 새 댓글',
    message: '홍길동님이 회원님의 게시글에 댓글을 남겼습니다.',
    data: {
      postId: 'test-post-123',
      commentId: 'test-comment-456',
      postTitle: '테스트 게시글',
      authorName: '홍길동',
      isAnonymous: false
    }
  },
  {
    name: '게시글 댓글 알림 (익명 사용자)',
    type: 'post_comment',
    title: '💬 새 댓글',
    message: '익명님이 회원님의 게시글에 댓글을 남겼습니다.',
    data: {
      postId: 'test-post-123',
      commentId: 'test-comment-789',
      postTitle: '테스트 게시글',
      authorName: '익명',
      isAnonymous: true
    }
  },
  {
    name: '댓글 답글 알림 (일반 사용자)',
    type: 'comment_reply',
    title: '↩️ 새 답글',
    message: '김철수님이 회원님의 댓글에 답글을 남겼습니다.',
    data: {
      postId: 'test-post-123',
      commentId: 'test-comment-456',
      replyId: 'test-reply-101',
      postTitle: '테스트 게시글',
      authorName: '김철수',
      isAnonymous: false
    }
  },
  {
    name: '댓글 답글 알림 (익명 사용자)',
    type: 'comment_reply',
    title: '↩️ 새 답글',
    message: '익명님이 회원님의 댓글에 답글을 남겼습니다.',
    data: {
      postId: 'test-post-123',
      commentId: 'test-comment-456',
      replyId: 'test-reply-102',
      postTitle: '테스트 게시글',
      authorName: '익명',
      isAnonymous: true
    }
  },
  {
    name: '추천인 등록 알림',
    type: 'referral',
    title: '🎯 추천인 등록',
    message: '이영희님이 회원님을 추천인으로 설정했습니다.',
    data: {
      targetUserId: 'test-user-123',
      referrerName: '이영희'
    }
  },
  {
    name: '시스템 알림',
    type: 'system',
    title: '📢 시스템 알림',
    message: '중요한 시스템 공지사항이 있습니다.',
    data: {}
  }
];

/**
 * Expo Push API를 사용하여 푸시 알림 발송
 */
async function sendExpoPushNotification(message) {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    if (result.data && result.data.length > 0) {
      const receipt = result.data[0];
      if (receipt.status === 'ok') {
        return { success: true, receipt };
      } else {
        return { success: false, error: receipt.message || 'Unknown error' };
      }
    } else {
      return { success: false, error: 'No receipt received' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 사용자의 푸시 토큰 조회
 */
async function getUserPushTokens(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new Error(`User ${userId} not found`);
    }

    const userData = userDoc.data();
    return userData.pushTokens || {};
  } catch (error) {
    console.error('사용자 푸시 토큰 조회 실패:', error);
    throw error;
  }
}

/**
 * 개선된 알림 시스템 테스트 실행
 */
async function testImprovedNotifications(userId) {
  console.log(`🚀 개선된 푸시 알림 시스템 테스트 시작 (사용자: ${userId})`);
  console.log('=' * 60);

  try {
    // 사용자 푸시 토큰 조회
    const pushTokens = await getUserPushTokens(userId);
    console.log(`📱 사용자 푸시 토큰 조회 완료:`, Object.keys(pushTokens));

    if (Object.keys(pushTokens).length === 0) {
      console.error('❌ 푸시 토큰이 없습니다. 앱에서 로그인 후 다시 시도해주세요.');
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    // 각 테스트 케이스 실행
    for (const testCase of IMPROVED_NOTIFICATION_TESTS) {
      console.log(`\n📤 테스트: ${testCase.name}`);
      console.log(`   제목: ${testCase.title}`);
      console.log(`   메시지: ${testCase.message}`);

      // 모든 토큰에 발송
      const sendPromises = [];
      
      Object.entries(pushTokens).forEach(([platform, tokenData]) => {
        if (tokenData?.token) {
          const message = {
            to: tokenData.token,
            title: testCase.title,
            body: testCase.message,
            data: {
              type: testCase.type,
              userId,
              ...testCase.data,
            },
            sound: 'default',
            priority: 'high',
          };

          sendPromises.push(
            sendExpoPushNotification(message).then(result => ({
              platform,
              ...result
            }))
          );
        }
      });

      if (sendPromises.length === 0) {
        console.log('   ⚠️ 발송할 토큰이 없음');
        failureCount++;
        continue;
      }

      // 모든 토큰에 발송
      const results = await Promise.allSettled(sendPromises);
      
      let hasSuccess = false;
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          console.log(`   ✅ ${result.value.platform} 발송 성공`);
          hasSuccess = true;
        } else {
          const error = result.status === 'fulfilled' ? result.value.error : result.reason;
          console.log(`   ❌ ${result.value?.platform || 'unknown'} 발송 실패: ${error}`);
        }
      });

      if (hasSuccess) {
        successCount++;
        console.log(`   🎉 테스트 성공`);
      } else {
        failureCount++;
        console.log(`   💥 테스트 실패`);
      }

      // 테스트 간 간격
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '=' * 60);
    console.log(`📊 테스트 결과:`);
    console.log(`   ✅ 성공: ${successCount}개`);
    console.log(`   ❌ 실패: ${failureCount}개`);
    console.log(`   📱 총 테스트: ${IMPROVED_NOTIFICATION_TESTS.length}개`);

    if (failureCount === 0) {
      console.log('\n🎉 모든 테스트가 성공적으로 완료되었습니다!');
      console.log('💡 개선된 알림 시스템이 정상적으로 작동하고 있습니다.');
    } else {
      console.log('\n⚠️ 일부 테스트가 실패했습니다. 로그를 확인해주세요.');
    }

  } catch (error) {
    console.error('❌ 테스트 실행 중 오류 발생:', error);
  }
}

// 메인 실행
async function main() {
  const userId = process.argv[2];
  
  if (!userId) {
    console.error('❌ 사용법: node test-improved-notifications.js [USER_ID]');
    console.error('   예시: node test-improved-notifications.js user123');
    process.exit(1);
  }

  await testImprovedNotifications(userId);
}

main().catch(console.error);
