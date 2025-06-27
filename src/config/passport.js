const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { db, auth, admin } = require("./firebase");

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "https://unighana-backend-awyo.onrender.com/auth/google/callback",
,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;

                if (!email) {
                    return done(null, false, { message: "google_auth_failed" });
                }

                // Look for user in Firebase Auth
                let authUser = null;
                try {
                    authUser = await auth.getUserByEmail(email);
                } catch (e) {
                    if (e.code !== "auth/user-not-found") {
                        return done(e, null);
                    }
                    // If not found → authUser stays null
                }

                if (authUser) {
                    const providers = authUser.providerData.map((p) => p.providerId);

                    if (providers.includes("password")) {
                        // ✅ CASE: exists with email/password
                        return done(null, false, {
                            message: "email_password_exists",
                        });
                    }

                    if (providers.includes("google.com")) {
                        // ✅ CASE: existing Google user → log in
                        // Find Firestore user data
                        const userRef = db.collection("users");
                        const snapshot = await userRef
                            .where("email", "==", email)
                            .limit(1)
                            .get();

                        let userData = null;
                        if (!snapshot.empty) {
                            userData = snapshot.docs[0].data();
                            userData.id = snapshot.docs[0].id;
                        }

                        return done(null, {
                            uid: authUser.uid,
                            ...userData,
                        });
                    }
                }

                // ✅ CASE: new Google signup
                // Create Firestore record
                const newUser = {
                    firstName: profile.name?.givenName || "",
                    lastName: profile.name?.familyName || "",
                    email: email,
                    educationLevel: "",
                    emailVerified: profile.emails?.[0]?.verified || false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                };

                const userDoc = await db.collection("users").add(newUser);

                // Create Auth user record
                // await auth.createUser({
                //     uid: userDoc.id,
                //     email: email,
                //     displayName: `${newUser.firstName} ${newUser.lastName}`.trim(),
                //     emailVerified: newUser.emailVerified,
                // });

                return done(null, {
                    id: userDoc.id,
                    ...newUser,
                });
            } catch (error) {
                console.error("GoogleStrategy error:", error);
                return done(error, null);
            }
        }
    )
);
