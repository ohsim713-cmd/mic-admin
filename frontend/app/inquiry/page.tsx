'use client';

import { useState } from 'react';

export default function InquiryPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        message: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const response = await fetch('/api/inquiries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: 'ウェブサイト',
                    ...formData
                })
            });

            if (response.ok) {
                setSubmitted(true);
                setFormData({ name: '', email: '', phone: '', message: '' });
            } else {
                alert('送信に失敗しました。もう一度お試しください。');
            }
        } catch (error) {
            console.error('Failed to submit inquiry:', error);
            alert('送信に失敗しました。もう一度お試しください。');
        } finally {
            setSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    if (submitted) {
        return (
            <div className="inquiry-container">
                <div className="success-message">
                    <div className="success-icon">✓</div>
                    <h1>お問い合わせありがとうございます!</h1>
                    <p>担当者より折り返しご連絡させていただきます。</p>
                    <button
                        className="back-button"
                        onClick={() => setSubmitted(false)}
                    >
                        新しい問い合わせを送信
                    </button>
                </div>

                <style jsx>{`
          .inquiry-container {
            padding: 2rem;
            max-width: 600px;
            margin: 0 auto;
          }

          .success-message {
            text-align: center;
            padding: 3rem;
            background: rgba(16, 185, 129, 0.1);
            border: 2px solid rgba(16, 185, 129, 0.3);
            border-radius: 16px;
          }

          .success-icon {
            width: 80px;
            height: 80px;
            margin: 0 auto 1.5rem;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 3rem;
            color: white;
            font-weight: bold;
          }

          .success-message h1 {
            margin: 0 0 1rem 0;
            color: #10b981;
          }

          .success-message p {
            color: rgba(255, 255, 255, 0.8);
            margin-bottom: 2rem;
          }

          .back-button {
            padding: 1rem 2rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
          }

          .back-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          }
        `}</style>
            </div>
        );
    }

    return (
        <div className="inquiry-container">
            <div className="inquiry-header">
                <h1>📧 お問い合わせ</h1>
                <p className="subtitle">お気軽にお問い合わせください</p>
            </div>

            <form onSubmit={handleSubmit} className="inquiry-form">
                <div className="form-group">
                    <label htmlFor="name">お名前 <span className="required">*</span></label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        placeholder="山田 太郎"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="email">メールアドレス <span className="required">*</span></label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        placeholder="example@email.com"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="phone">電話番号</label>
                    <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="090-1234-5678"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="message">お問い合わせ内容 <span className="required">*</span></label>
                    <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        rows={6}
                        placeholder="お問い合わせ内容をご記入ください"
                    />
                </div>

                <button
                    type="submit"
                    className="submit-button"
                    disabled={submitting}
                >
                    {submitting ? '送信中...' : '送信する'}
                </button>
            </form>

            <style jsx>{`
        .inquiry-container {
          padding: 2rem;
          max-width: 600px;
          margin: 0 auto;
        }

        .inquiry-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .inquiry-header h1 {
          font-size: 2rem;
          margin: 0 0 0.5rem 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .subtitle {
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
        }

        .inquiry-form {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 2rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 600;
        }

        .required {
          color: #ef4444;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          color: white;
          font-size: 1rem;
          transition: all 0.3s ease;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #667eea;
          background: rgba(255, 255, 255, 0.08);
        }

        .form-group input::placeholder,
        .form-group textarea::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .form-group textarea {
          resize: vertical;
          font-family: inherit;
        }

        .submit-button {
          width: 100%;
          padding: 1rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }

        .submit-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
        </div>
    );
}
