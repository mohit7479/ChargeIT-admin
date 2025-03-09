import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore"; // Firestore functions
import { auth, db } from "../firebase-config-database.js"; // Import Firestore
import { useFormik } from "formik";
import bg from "../bg.jpg";
import { useNavigate } from "react-router-dom";

const initialValues = {
  email: "",
  password: "",
};

function SignUp() {
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const { values, errors, touched, handleBlur, handleChange, handleSubmit } =
    useFormik({
      initialValues: initialValues,
      onSubmit: async (values, action) => {
        try {
          // Step 1: Create User in Firebase Authentication
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            values.email,
            values.password
          );
          const user = userCredential.user;

          // Step 2: Store user data in Firestore
          await setDoc(doc(db, "admins", user.uid), {
            email: values.email,
            role: "admin", // Assigning role as "admin"
          });

          alert("Signup successful");
          navigate("/landpage");
        } catch (error) {
          setError(error.message);
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
        <h1 className="text-2xl font-semibold text-gray-800 mb-4">Sign Up</h1>
        <h3 className="text-lg text-gray-600 mb-6">
          Create your Charge IT Admin account
        </h3>

        {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="email"
            >
              Email
            </label>
            <input
              className="border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              type="email"
              name="email"
              id="email"
              placeholder="Email"
              autoComplete="off"
              value={values.email}
              onChange={handleChange}
              onBlur={handleBlur}
            />
            {errors.email && touched.email && (
              <p className="text-red-500 text-xs italic">{errors.email}</p>
            )}
          </div>
          <div className="mb-4">
            <label
              className="block text-gray-700 text-sm font-bold mb-2"
              htmlFor="password"
            >
              Password
            </label>
            <input
              className="border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              type="password"
              name="password"
              id="password"
              placeholder="Password"
              autoComplete="off"
              value={values.password}
              onChange={handleChange}
              onBlur={handleBlur}
            />
            {errors.password && touched.password && (
              <p className="text-red-500 text-xs italic">{errors.password}</p>
            )}
          </div>
          <div className="mb-6 text-center">
            <button
              className="bg-blue-700 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline"
              type="submit"
            >
              Sign Up
            </button>
          </div>
        </form>
        <div className="text-center">
          <p className="text-gray-600 text-sm">Already have an account?</p>
          <button
            className="text-blue-500 hover:underline"
            onClick={() => navigate("/login")}
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default SignUp;
