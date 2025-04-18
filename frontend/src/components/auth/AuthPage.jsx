// frontend/src/components/auth/AuthPage.jsx
import React, { useState } from 'react';
import Login from './Login';
import SignUp from './SignUp';

function AuthPage() {
    const [showLogin, setShowLogin] = useState(true);

    const switchToSignUp = () => setShowLogin(false);
    const switchToLogin = () => setShowLogin(true);

    return (
        <div>
            {showLogin ? (
                <Login switchToSignUp={switchToSignUp} />
            ) : (
                <SignUp switchToLogin={switchToLogin} />
            )}
        </div>
    );
}

export default AuthPage;