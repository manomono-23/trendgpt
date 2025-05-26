(function() {
  'use strict';
  
  // Stripe初期化
  const stripe = Stripe('pk_test_51RSFauIZcGrzosQpPDSnddjws2qTa5FhuoSXASL4DdeXcca1bWwPY0QutSBOtTyWCxE0kV71Bs5Ycekt3kSAylyi00bDvZjDGx');
  
  // API URL設定
  const API_BASE_URL = 'https://us-central1-stripe-subscription-manager.cloudfunctions.net/createSubscription';
  
  // DOM要素取得
  const elements = {
      sameEmailCheckbox: document.getElementById('same-email'),
      singleEmailGroup: document.getElementById('single-email-group'),
      separateEmailGroup: document.getElementById('separate-email-group'),
      singleEmail: document.getElementById('single-email'),
      deliveryEmail: document.getElementById('delivery-email'),
      paymentEmail: document.getElementById('payment-email'),
      subscriberName: document.getElementById('subscriber-name'),
      agreeTerms: document.getElementById('agree-terms'),
      submitBtn: document.getElementById('submit-btn'),
      form: document.getElementById('subscription-form'),
      loading: document.getElementById('loading'),
      errorDiv: document.getElementById('form-error'),
      modal: document.getElementById('modal'),
      modalTitle: document.getElementById('modal-title'),
      modalBody: document.getElementById('modal-body')
  };
  
  // 法的文書データ
  let legalData = {
      terms: null,
      privacy: null,
      commerce: null
  };
  
  // 初期化
  function init() {
      loadLegalData();
      bindEvents();
      validateForm();
  }
  
  // 法的文書データ読み込み
  async function loadLegalData() {
      try {
          // 各ファイルを並行読み込み
          const [termsResponse, privacyResponse, commerceResponse] = await Promise.all([
              fetch('terms.json'),
              fetch('privacy.json'),
              fetch('legal.json')
          ]);
          
          legalData.terms = await termsResponse.json();
          legalData.privacy = await privacyResponse.json();
          legalData.commerce = await commerceResponse.json();
          
          console.log('法的文書データの読み込み完了');
      } catch (error) {
          console.error('法的文書の読み込みに失敗:', error);
          // フォールバック用のダミーデータ
          legalData = {
              terms: { title: '利用規約', content: [{ type: 'section', title: '', content: '法的文書を読み込み中です...' }] },
              privacy: { title: 'プライバシーポリシー', content: [{ type: 'section', title: '', content: '法的文書を読み込み中です...' }] },
              commerce: { title: '特定商取引法に基づく表記', content: [{ type: 'section', title: '', content: '法的文書を読み込み中です...' }] }
          };
      }
  }
  
  // イベントバインド
  function bindEvents() {
      // メールアドレス切り替え
      if (elements.sameEmailCheckbox) {
          elements.sameEmailCheckbox.addEventListener('change', toggleEmailFields);
      }
      
      // 利用規約同意チェック
      if (elements.agreeTerms) {
          elements.agreeTerms.addEventListener('change', validateForm);
      }
      
      // フォーム送信
      if (elements.form) {
          elements.form.addEventListener('submit', handleFormSubmit);
      }
      
      // モーダル外クリックで閉じる
      if (elements.modal) {
          elements.modal.addEventListener('click', function(e) {
              if (e.target === elements.modal) {
                  closeModal();
              }
          });
      }
      
      // ESCキーでモーダルを閉じる
      document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape' && elements.modal && elements.modal.style.display === 'block') {
              closeModal();
          }
      });
  }
  
  // メールアドレス入力フィールド切り替え
  function toggleEmailFields() {
      const sameEmail = elements.sameEmailCheckbox.checked;
      
      if (sameEmail) {
          elements.singleEmailGroup.style.display = 'block';
          elements.separateEmailGroup.style.display = 'none';
          elements.singleEmail.required = true;
          elements.deliveryEmail.required = false;
          elements.paymentEmail.required = false;
      } else {
          elements.singleEmailGroup.style.display = 'none';
          elements.separateEmailGroup.style.display = 'block';
          elements.singleEmail.required = false;
          elements.deliveryEmail.required = true;
          elements.paymentEmail.required = true;
      }
  }
  
  // フォームバリデーション
  function validateForm() {
      const isValid = elements.agreeTerms && elements.agreeTerms.checked;
      if (elements.submitBtn) {
          elements.submitBtn.disabled = !isValid;
      }
  }
  
  // フォーム送信処理
  async function handleFormSubmit(e) {
      e.preventDefault();
      
      // フォームデータ収集
      const formData = collectFormData();
      
      // バリデーション
      if (!validateFormData(formData)) {
          return;
      }
      
      // UI更新（ローディング表示）
      showLoading();
      
      try {
          // Stripe Checkoutセッション作成
          const response = await fetch(`${API_BASE_URL}/createSubscription`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                  deliveryEmail: formData.deliveryEmail,
                  paymentEmail: formData.paymentEmail,
                  subscriberName: formData.subscriberName,
                  planType: formData.planType,
                  category: formData.category,
                  emailFormat: formData.emailFormat
              })
          });
          
          if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`サーバーエラー: ${response.status} ${errorText}`);
          }
          
          const responseData = await response.json();
          
          if (!responseData.sessionId) {
              throw new Error('セッションIDが取得できませんでした');
          }
          
          // Stripe Checkoutにリダイレクト
          const { error } = await stripe.redirectToCheckout({
              sessionId: responseData.sessionId
          });
          
          if (error) {
              throw new Error(`Stripe決済エラー: ${error.message}`);
          }
          
      } catch (error) {
          console.error('Form submission error:', error);
          showError(error.message || 'エラーが発生しました。もう一度お試しください。');
          hideLoading();
      }
  }
  
  // フォームデータ収集
  function collectFormData() {
      const sameEmail = elements.sameEmailCheckbox.checked;
      let deliveryEmail, paymentEmail;
      
      if (sameEmail) {
          const email = elements.singleEmail.value.trim();
          deliveryEmail = email;
          paymentEmail = email;
      } else {
          deliveryEmail = elements.deliveryEmail.value.trim();
          paymentEmail = elements.paymentEmail.value.trim();
      }
      
      const planElement = document.querySelector('input[name="plan"]:checked');
      const categoryElement = document.querySelector('input[name="category"]:checked');
      const formatElement = document.querySelector('input[name="email-format"]:checked');
      
      return {
          deliveryEmail,
          paymentEmail,
          subscriberName: elements.subscriberName.value.trim(),
          planType: planElement ? planElement.value : 'individual',
          category: categoryElement ? categoryElement.value : 'ai',
          emailFormat: formatElement ? formatElement.value : 'html',
          agreeTerms: elements.agreeTerms.checked
      };
  }
  
  // フォームデータバリデーション
  function validateFormData(data) {
      // 必須項目チェック
      if (!data.deliveryEmail || !data.paymentEmail || !data.subscriberName) {
          showError('全ての必須項目を入力してください');
          return false;
      }
      
      // メールアドレス形式チェック
      if (!isValidEmail(data.deliveryEmail)) {
          showError('有効な配信先メールアドレスを入力してください');
          return false;
      }
      
      if (!isValidEmail(data.paymentEmail)) {
          showError('有効な支払い用メールアドレスを入力してください');
          return false;
      }
      
      // 名前の長さチェック
      if (data.subscriberName.length < 1 || data.subscriberName.length > 50) {
          showError('登録者名は1文字以上50文字以下で入力してください');
          return false;
      }
      
      // 利用規約同意チェック
      if (!data.agreeTerms) {
          showError('利用規約、プライバシーポリシー、特定商取引法に基づく表記に同意してください');
          return false;
      }
      
      return true;
  }
  
  // メールアドレス形式チェック
  function isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
  }
  
  // ローディング表示
  function showLoading() {
      if (elements.submitBtn) {
          elements.submitBtn.style.display = 'none';
      }
      if (elements.loading) {
          elements.loading.style.display = 'block';
      }
      hideError();
  }
  
  // ローディング非表示
  function hideLoading() {
      if (elements.submitBtn) {
          elements.submitBtn.style.display = 'block';
      }
      if (elements.loading) {
          elements.loading.style.display = 'none';
      }
  }
  
  // エラー表示
  function showError(message) {
      if (elements.errorDiv) {
          elements.errorDiv.textContent = message;
          elements.errorDiv.style.display = 'block';
          // エラー位置にスクロール
          elements.errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
  }
  
  // エラー非表示
  function hideError() {
      if (elements.errorDiv) {
          elements.errorDiv.style.display = 'none';
      }
  }
  
  // モーダル表示
  function showModal(type) {
      // データマッピング
      const dataMap = {
          'terms': 'terms',
          'privacy': 'privacy',
          'commerce': 'commerce'
      };
      
      const dataKey = dataMap[type];
      if (!dataKey || !legalData[dataKey]) {
          console.error('法的文書データが見つかりません:', type);
          showError('法的文書の読み込みに失敗しました。ページを再読み込みしてください。');
          return;
      }
      
      const data = legalData[dataKey];
      if (elements.modalTitle) {
          elements.modalTitle.textContent = data.title;
      }
      if (elements.modalBody) {
          elements.modalBody.innerHTML = formatLegalContent(data.content);
      }
      if (elements.modal) {
          elements.modal.style.display = 'block';
      }
      document.body.style.overflow = 'hidden';
  }
  
  // モーダル非表示
  function closeModal() {
      if (elements.modal) {
          elements.modal.style.display = 'none';
      }
      document.body.style.overflow = 'auto';
  }
  
  // 法的文書コンテンツフォーマット
  function formatLegalContent(content) {
      if (!Array.isArray(content)) {
          return '<p>コンテンツの読み込みに失敗しました。</p>';
      }
      
      return content.map(section => {
          if (!section || typeof section !== 'object') {
              return '';
          }
          
          const title = section.title ? `<h3>${escapeHtml(section.title)}</h3>` : '';
          const sectionContent = section.content ? formatSectionContent(section.content) : '';
          
          return title + sectionContent;
      }).filter(html => html.length > 0).join('');
  }
  
  // セクションコンテンツのフォーマット
  function formatSectionContent(content) {
      if (!content) return '';
      
      // 改行を<br>タグに変換し、段落分けを行う
      const paragraphs = content.split('\n\n');
      return paragraphs.map(paragraph => {
          const formattedParagraph = escapeHtml(paragraph).replace(/\n/g, '<br>');
          return `<p>${formattedParagraph}</p>`;
      }).join('');
  }
  
  // HTMLエスケープ
  function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
  }
  
  // グローバル関数として公開（HTMLから呼び出すため）
  window.toggleEmailFields = toggleEmailFields;
  window.showModal = showModal;
  window.closeModal = closeModal;
  
  // DOMContentLoaded後に初期化
  if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
  } else {
      init();
  }
  
})();