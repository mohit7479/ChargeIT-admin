// import React, { useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { auth } from "../firebase-config-auth"; // Assuming you have a firebase.js file where you initialize Firebase

// const LandingPage = () => {
//   const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(null); // Initially, set to null to indicate loading state
//   const navigate = useNavigate();

//   useEffect(() => {
//     const unsubscribe = auth.onAuthStateChanged((user) => {
//       if (user) {
//         setIsAdminLoggedIn(user);
//       } else {
//         setIsAdminLoggedIn(false);
//       }
//     });

//     return () => unsubscribe();
//   }, []);

//   useEffect(() => {
//     if (isAdminLoggedIn === false) {
//       // If user is not authenticated, redirect to login page or handle accordingly
//       navigate("/login");
//     }
//   }, [isAdminLoggedIn, navigate]);

//   const handleBookingClick = () => {
//     navigate("/bookings");
//   };

//   const handleBatterySwapClick = () => {
//     navigate("/battery");
//   };

//   if (isAdminLoggedIn === null) {
//     // If authentication status is not yet determined, render a loading state
//     return <p>Loading...</p>;
//   }

//   return (
//     <div className="flex justify-center">
//       <div className="max-w-xs mx-4">
//         <div className="bg-white rounded-lg shadow-md p-6 mb-4">
//           <h3
//             className="text-lg font-semibold mb-2 cursor-pointer hover:text-blue-500"
//             onClick={handleBookingClick}
//           >
//             Bookings
//           </h3>
//           <p className="text-gray-600">Click here to navigate to bookings.</p>
//         </div>
//         <div className="bg-white rounded-lg shadow-md p-6">
//           <h3
//             className="text-lg font-semibold mb-2 cursor-pointer hover:text-blue-500"
//             onClick={handleBatterySwapClick}
//           >
//             Battery Swap
//           </h3>
//           <p className="text-gray-600">
//             Click here to navigate to battery swap.
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default LandingPage;
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase-config-database";
import bg from "../bg.jpg";

const LandingPage = () => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setIsAdminLoggedIn(user);
      } else {
        setIsAdminLoggedIn(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isAdminLoggedIn === false) {
      navigate("/login");
    }
  }, [isAdminLoggedIn, navigate]);

  const handleBookingClick = () => {
    navigate("/bookings");
  };

  const handleBatterySwapClick = () => {
    navigate("/battery");
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate("/");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  if (isAdminLoggedIn === null) {
    return <p>Loading...</p>;
  }

  return (
    <div
      className="flex flex-col justify-center items-center h-screen"
      style={{ backgroundImage: `url(${bg})`, backgroundSize: "cover" }}
    >
      <div className="flex">
        <div className="max-w-card mx-4">
          <div className="bg-white rounded-lg shadow-md p-6 mb-4">
            <h3
              className="text-lg font-semibold mb-2 cursor-pointer hover:text-blue-500"
              onClick={handleBookingClick}
            >
              Bookings
            </h3>
            <p className="text-gray-600">Click here to navigate to bookings.</p>
          </div>
        </div>
        <div className="max-w-card mx-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3
              className="text-lg font-semibold mb-2 cursor-pointer hover:text-blue-500"
              onClick={handleBatterySwapClick}
            >
              Battery Swap
            </h3>
            <p className="text-gray-600">
              Click here to navigate to battery swap.
            </p>
          </div>
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="mt-6 bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition"
      >
        Logout
      </button>
    </div>
  );
};

export default LandingPage;
