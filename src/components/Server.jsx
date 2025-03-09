import React, { useState, useEffect } from "react";
import { getDatabase, ref, get, remove, update } from "firebase/database";
import bgImage from "../bg.jpg";
import app from "../firebase-config-database";

function Server() {
  const [bookings, setBookings] = useState([]);
  useEffect(() => {
    checkBookings();
  }, []);

  const checkBookings = async () => {
    const db = getDatabase();
    const bookingsRef = ref(db, "bookings/");

    try {
      const snapshot = await get(bookingsRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        const bookingsList = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setBookings(bookingsList);
      }
    } catch (error) {
      console.error("Error reading data:", error);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    const db = getDatabase();
    const bookingRef = ref(db, `bookings/${bookingId}`);

    try {
      await remove(bookingRef);
      setBookings((prevBookings) =>
        prevBookings.filter((booking) => booking.id !== bookingId)
      );
      alert("Booking has been cancelled.");
    } catch (error) {
      console.error("Error cancelling booking:", error);
    }
  };

  const handlePaymentConfirmation = async (bookingId) => {
    const confirmation = window.confirm(
      "Confirm payment? This will remove the booking details."
    );

    if (confirmation) {
      const db = getDatabase();
      const bookingRef = ref(db, `bookings/${bookingId}`);

      try {
        await remove(bookingRef);
        setBookings((prevBookings) =>
          prevBookings.filter((booking) => booking.id !== bookingId)
        );
        alert("Booking has been fulfilled.");
      } catch (error) {
        console.error("Error confirming payment:", error);
      }
    }
  };

  const calculateBill = (booking) => {
    if (booking.vehicleType === "two-wheeler") {
      return "Rs 40";
    } else if (booking.vehicleType === "four-wheeler") {
      return booking.chargingType === "AC" ? "Rs 40" : "Rs 400";
    }
    return "Unknown";
  };

  return (
    <div
      className="relative flex items-center justify-center min-h-screen bg-cover"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="mx-auto max-w-4xl py-4 px-8 bg-white shadow-lg rounded-lg relative z-10">
        <div className="text-center mb-6">
          <p className="text-lg font-semibold">Our Bookings</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {bookings.length > 0 ? (
            bookings.map((booking) => (
              <div key={booking.id} className="p-6 bg-gray-100 rounded-lg">
                <p className="text-xl font-bold mb-4">
                  We have a booking with:
                </p>
                <p className="text-lg">
                  <strong>Name:</strong> {booking.name}
                </p>
                <p className="text-lg">
                  <strong>Vehicle ID:</strong> {booking.vehicleNumber}
                </p>
                <p className="text-lg">
                  <strong>Location:</strong> {booking.selectedLocation}
                </p>
                <p className="text-lg">
                  <strong>Time:</strong> {booking.bookingTime}
                </p>
                <p className="text-lg">
                  <strong>Vehicle Type:</strong> {booking.vehicleType}
                </p>
                <p className="text-lg">
                  <strong>Charging Type:</strong> {booking.chargingType}
                </p>
                <p className="text-lg">Bill: {calculateBill(booking)}</p>
                <div className="flex justify-between items-center mt-4">
                  <button
                    onClick={() => handleCancelBooking(booking.id)}
                    className="bg-red-500 text-white px-4 py-2 rounded-full hover:bg-red-600 focus:outline-none"
                  >
                    Cancel Booking
                  </button>
                  <button
                    onClick={() => handlePaymentConfirmation(booking.id)}
                    className="bg-green-500 text-white px-4 py-2 rounded-full hover:bg-green-600 focus:outline-none"
                  >
                    Bill Paid
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="col-span-2 text-center">No bookings found.</p>
          )}
        </div>
        <div className="text-center my-4"></div>
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
//               <p className="text-xl font-bold mb-4">We have a booking with:</p>
//               <p className="text-lg">
//                 <strong>Name:</strong> {booking.name}
//               </p>
//               <p className="text-lg">
//                 <strong>Vehicle ID:</strong> {booking.vehicleNumber}
//               </p>
//               <p className="text-lg">
//                 <strong>Location:</strong> {booking.selectedLocation}
//               </p>
//               <p className="text-lg">
//                 <strong>Time:</strong> {booking.bookingTime}
//               </p>
//               <p className="text-lg">
//                 <strong>Vehicle Type:</strong> {booking.vehicleType}
//               </p>
//               <p className="text-lg">
//                 <strong>Charging Type:</strong> {booking.chargingType}
//               </p>
//               <p className="text-lg">Bill: {calculateBill(booking)}</p>
//               <div className="flex justify-between items-center mt-4">
//                 <button
//                   onClick={() => handleCancelBooking(booking.id)}
//                   className="bg-red-500 text-white px-4 py-2 rounded-full hover:bg-red-600 focus:outline-none"
//                 >
//                   Cancel Booking
//                 </button>
//                 <div className="flex items-center">
//                   <button
//                     onClick={() => handlePaymentConfirmation(booking.id)}
//                     className="bg-green-500 text-white px-4 py-2 rounded-full hover:bg-green-600 focus:outline-none"
//                   >
//                     Bill Paid
//                   </button>
//                 </div>
//               </div>
//             </div>
//           ))
//         ) : (
//           <p>No bookings found.</p>
//         )}
//         <div className="text-center my-4"></div>
//       </div>
//     </div>
//   );
// }

export default Server;
