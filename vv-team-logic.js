// FISIER: vv-team-logic.js

async function approveMission(missionId, userId, rewardAmount) {
    const db = firebase.firestore();
    const batch = db.batch();

    const missionRef = db.collection('missions').doc(missionId);
    const userRef = db.collection('users').doc(userId);

    // 1. Update misiune
    batch.update(missionRef, { status: 'approved', validatedAt: new Date() });

    // 2. Update balanta VV Coins
    batch.update(userRef, { vvCoins: firebase.firestore.FieldValue.increment(rewardAmount) });

    try {
        await batch.commit();
        
        // 3. Logare in ecosistem
        VVhi.logApproval({
            missionId: missionId,
            userId: userId,
            timestamp: new Date().toISOString(),
            action: 'REWARD_COINS',
            amount: rewardAmount
        });

        console.log(`Misiune ${missionId} aprobata. VVhi logat.`);
    } catch (error) {
        console.error("Eroare validare:", error);
    }
}