import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase-config-database";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useFormik } from "formik";
import bg from "../bg.jpg";
import { useNavigate } from "react-router-dom";

const initialValues = {
  email: "",
  password: "",
};

function AdminLogin() {
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        checkAdminRole(currentUser.email);
      }
    });

    return () => unsubscribe();
  }, []);

  const checkAdminRole = async (email) => {
    try {
      const adminsRef = collection(db, "admins");
      const q = query(adminsRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        navigate("/landpage"); // Redirect if user is an admin
      } else {
        setErrorMessage("Access denied: Not an admin.");
      }
    } catch (error) {
      console.error("Error checking admin role:", error.message);
    }
  };

  const { values, errors, touched, handleBlur, handleChange, handleSubmit } =
    useFormik({
      initialValues: initialValues,
      onSubmit: async (values, action) => {
        try {
          const userCredential = await signInWithEmailAndPassword(
            auth,
            values.email,
            values.password
          );
          const user = userCredential.user;

          checkAdminRole(user.email);
        } catch (error) {
          console.error("Login error:", error.message);
          setErrorMessage("Invalid email or password.");
        }
      },
    });

  return (
    <div
      className="relative flex items-center justify-center min-h-screen"
      style={{ backgroundImage: `url(${bg})`, backgroundSize: "cover" }}
    >
      <div className="absolute inset-0 bg-black opacity-50 pointer-events-none"></div>
      <div className="mx-auto max-w-lg py-4 px-8 bg-white shadow-lg rounded-lg relative z-10">
        <h1 className="text-2xl font-semibold text-gray-800 mb-4">Welcome!</h1>
        <h3 className="text-lg text-gray-600 mb-6">Charge IT Admin Login</h3>

        {errorMessage && <p className="text-red-500">{errorMessage}</p>}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              className="border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline w-full"
              type="email"
              name="email"
              placeholder="Email"
              autoComplete="off"
              value={values.email}
              onChange={handleChange}
              onBlur={handleBlur}
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Password
            </label>
            <input
              className="border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline w-full"
              type="password"
              name="password"
              placeholder="Password"
              autoComplete="off"
              value={values.password}
              onChange={handleChange}
              onBlur={handleBlur}
            />
          </div>
          <div className="mb-6 text-center">
            <button
              className="bg-green-700 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline"
              type="submit"
            >
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;
