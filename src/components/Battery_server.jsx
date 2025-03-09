import React, { useState, useEffect } from "react";
import { getDatabase, ref, onValue, remove } from "firebase/database";
import { auth, db, realtime } from "../firebase-config-database";
import { doc, getDoc } from "firebase/firestore";
import bgImage from "../bg.jpg";

function Battery_Server() {
  const [bookings, setBookings] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const userRef = doc(db, "admins", user.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists() && userSnap.data().role === "admin") {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        }
      } catch (error) {
        console.error("Error checking admin role:", error);
      }
    };

    checkAdmin();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const database = getDatabase();
    const bookingsRef = ref(realtime, "battery/");

    const unsubscribe = onValue(bookingsRef, (snapshot) => {
      const data = snapshot.val();
      console.log(data);
      if (data) {
        const bookingsList = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...(typeof value === "object" ? value : {}),
        }));
        setBookings(bookingsList);
      } else {
        setBookings([]);
      }
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [isAdmin]);

  const handleCancelBooking = async (bookingId) => {
    const database = getDatabase();
    const bookingRef = ref(database, `battery/${bookingId}`);

    try {
      await remove(bookingRef);
      setBookings((prev) => prev.filter((booking) => booking.id !== bookingId));
      alert("Battery booking has been removed.");
    } catch (error) {
      console.error("Error removing booking:", error);
    }
  };

  return (
    <div
      className="relative flex items-center justify-center min-h-screen"
      style={{ backgroundImage: `url(${bgImage})`, backgroundSize: "cover" }}
    >
      <div className="absolute inset-0 bg-black opacity-50 pointer-events-none"></div>
      <div className="mx-auto max-w-4xl py-4 px-8 bg-white shadow-lg rounded-lg relative z-10">
        <div className="text-center mb-6">
          <p className="text-lg font-semibold">Battery Bookings</p>
        </div>
        {isAdmin ? (
          <div className="grid grid-cols-1 gap-4">
            {bookings.length > 0 ? (
              bookings.map((booking) => (
                <div key={booking.id} className="p-6 bg-gray-100 rounded-lg">
                  <p className="text-xl font-bold mb-4">Booking Details:</p>
                  <p className="text-lg">
                    <strong>Name:</strong> {booking.name}
                  </p>
                  <p className="text-lg">
                    <strong>Email:</strong> {booking.email}
                  </p>
                  <p className="text-lg">
                    <strong>Phone:</strong> {booking.phone}
                  </p>
                  <p className="text-lg">
                    <strong>Address:</strong> {booking.address}
                  </p>
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => handleCancelBooking(booking.id)}
                      className="bg-red-500 text-white px-4 py-2 rounded-full hover:bg-red-600 focus:outline-none"
                    >
                      Remove Booking
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p>No bookings found.</p>
            )}
          </div>
        ) : (
          <p className="text-center text-red-500">Access Denied: Admins only</p>
        )}
      </div>
    </div>
  );
}

//   return (
//     <div
//       className="relative flex items-center justify-center min-h-screen"
//       style={{ backgroundImage: `url(${bgImage})`, backgroundSize: "cover" }}
//     >
//       <div className="absolute inset-0 bg-black opacity-50 pointer-events-none"></div>
//       <div className="mx-auto max-w-4xl py-4 px-8 bg-white shadow-lg rounded-lg relative z-10">
//         <div className="text-center mb-6">
//           <p className="text-lg font-semibold">Our Bookings</p>
//         </div>
//         {bookings.length > 0 ? (
//           bookings.map((booking) => (
//             <div key={booking.id} className="mb-8 p-6 bg-gray-100 rounded-lg">
//               <p className="text-xl font-bold mb-4">Booking Information:</p>
//               <p className="text-lg">
//                 <strong>Name:</strong> {booking.name}
//               </p>
//               <p className="text-lg">
//                 <strong>Email:</strong> {booking.email}
//               </p>
//               <p className="text-lg">
//                 <strong>Phone:</strong> {booking.phone}
//               </p>
//               <p className="text-lg">
//                 <strong>Address:</strong> {booking.address}
//               </p>
//               <div className="flex justify-end mt-4">
//                 <button
//                   onClick={() => handleCancelBooking(booking.id)}
//                   className="bg-green-500 text-white px-4 py-2 rounded-full hover:bg-red-600 focus:outline-none"
//                 >
//                   Delivered
//                 </button>
//               </div>
//             </div>
//           ))
//         ) : (
//           <p>No bookings found.</p>
//         )}
//       </div>
//     </div>
//   );
// }

export default Battery_Server;
