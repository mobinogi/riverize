// ====================================================================
// 📱 [핵심] 모바일 키보드 대응 (담당자 버튼 클릭 시 덜컹거림 방지 추가)
// ====================================================================
let keyboardBlurTimer = null;

function attachMobileKeyboardFix() {
    const inputs = [
        document.getElementById('qe-input-1'),
        document.getElementById('qe-input-2'),
        document.getElementById('qe-input-3')
    ];
    
    const managerBtns = [
        document.getElementById('qe-btn-kim'),
        document.getElementById('qe-btn-jung')
    ];
    
    const modalWrapper = document.getElementById('quick-entry-modal');

    // 1. 입력창 이벤트 연결
    inputs.forEach(input => {
        if(!input) return;

        // 🚀 [올리기] 터치했을 때
        input.addEventListener('focus', () => {
            if (window.innerWidth <= 768) {
                if (keyboardBlurTimer) clearTimeout(keyboardBlurTimer);
                
                modalWrapper.style.alignItems = 'flex-start';
                modalWrapper.style.paddingTop = '40px'; 
            }
        });

        // 🛬 [내리기] 다른 곳 눌렀을 때 (잠깐 대기)
        input.addEventListener('blur', () => {
            if (window.innerWidth <= 768) {
                keyboardBlurTimer = setTimeout(() => {
                    modalWrapper.style.alignItems = '';
                    modalWrapper.style.paddingTop = '';
                }, 200);
            }
        });
    });

    // 2. [신규] 담당자 버튼 이벤트 연결 (내려가기 방지)
    managerBtns.forEach(btn => {
        if(!btn) return;
        
        // 담당자 버튼을 누르면 "내려가기 예약"을 취소해버림!
        btn.addEventListener('click', () => {
            if (keyboardBlurTimer) clearTimeout(keyboardBlurTimer);
            
            // 혹시 내려가 있다면 다시 올림 (선택사항)
            if (window.innerWidth <= 768) {
                modalWrapper.style.alignItems = 'flex-start';
                modalWrapper.style.paddingTop = '40px'; 
            }
        });
        
        // 모바일 터치 시에도 적용
        btn.addEventListener('touchstart', () => {
            if (keyboardBlurTimer) clearTimeout(keyboardBlurTimer);
        }, { passive: true });
    });
}

// 스크립트 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
    attachMobileKeyboardFix();
});
