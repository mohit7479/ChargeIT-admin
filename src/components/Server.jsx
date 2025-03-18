import React, { useState, useEffect } from "react";
import {
  getDatabase,
  ref,
  get,
  remove,
  update,
  onValue,
  push,
  set,
} from "firebase/database";
import { QRCodeCanvas } from "qrcode.react";
// or
import { QRCodeSVG } from "qrcode.react";
// You'll need to install this package
import bgImage from "../bg.jpg";
import app from "../firebase-config-database";

function Server() {
  const [bookings, setBookings] = useState([]);
  const [queuedUsers, setQueuedUsers] = useState([]);
  const [timeSlots, setTimeSlots] = useState({});
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locations, setLocations] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState({});

  useEffect(() => {
    initializeTimeSlots();
    checkBookings();
    monitorQueue();
    monitorPayments();
  }, []);

  // Initialize time slots
  const initializeTimeSlots = async () => {
    const db = getDatabase();
    const slotsRef = ref(db, "timeSlots/");

    try {
      const snapshot = await get(slotsRef);
      if (snapshot.exists()) {
        const timeSlotsData = snapshot.val();
        setTimeSlots(timeSlotsData);

        // Extract available locations
        const availableLocations = Object.keys(timeSlotsData);
        setLocations(availableLocations);
      } else {
        const defaultTimeSlots = {};
        // Updated with more relevant locations
        const locations = ["EDAPALLY", "FORT KOCHI", "KAKKANAD", "VYTILLA"];
        const vehicleTypes = ["two-wheeler", "four-wheeler"];
        const chargingTypes = ["AC", "DC"];
        const hours = Array.from(
          { length: 24 },
          (_, i) => i.toString().padStart(2, "0") + ":00"
        );

        locations.forEach((location) => {
          defaultTimeSlots[location] = {};
          vehicleTypes.forEach((vehicleType) => {
            defaultTimeSlots[location][vehicleType] = {};
            chargingTypes.forEach((chargingType) => {
              defaultTimeSlots[location][vehicleType][chargingType] = {};
              hours.forEach((hour) => {
                defaultTimeSlots[location][vehicleType][chargingType][
                  hour
                ] = true; // true means available
              });
            });
          });
        });

        await set(slotsRef, defaultTimeSlots);
        setTimeSlots(defaultTimeSlots);
        setLocations(locations);
      }
    } catch (error) {
      console.error("Error initializing time slots:", error);
    }
  };

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

        // Only update time slots if we have the data available
        if (Object.keys(timeSlots).length > 0) {
          updateTimeSlotsFromBookings(bookingsList);
        }
      }
    } catch (error) {
      console.error("Error reading booking data:", error);
    }
  };

  const updateTimeSlotsFromBookings = (bookingsList) => {
    // Create a copy of the current time slots
    const updatedTimeSlots = JSON.parse(JSON.stringify(timeSlots));

    // Mark booked slots as unavailable
    bookingsList.forEach((booking) => {
      const { selectedLocation, vehicleType, chargingType, bookingTime } =
        booking;

      if (!bookingTime) return; // Skip if booking time is undefined

      const hourSlot = bookingTime.split(" ")[1]; // Extract hour from "DD/MM/YYYY HH:00" format

      if (
        updatedTimeSlots[selectedLocation]?.[vehicleType]?.[chargingType]?.[
          hourSlot
        ] !== undefined
      ) {
        updatedTimeSlots[selectedLocation][vehicleType][chargingType][
          hourSlot
        ] = false; // false means booked/unavailable
      }
    });

    // Update the time slots state
    setTimeSlots(updatedTimeSlots);

    // Update in database
    const db = getDatabase();
    const slotsRef = ref(db, "timeSlots/");
    set(slotsRef, updatedTimeSlots).catch((error) => {
      console.error("Error updating time slots:", error);
    });
  };

  const monitorQueue = () => {
    const db = getDatabase();
    const queueRef = ref(db, "queue/");

    // Set up real-time listener for the queue
    onValue(queueRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const queueList = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setQueuedUsers(queueList);
      } else {
        setQueuedUsers([]);
      }
    });
  };

  // Monitor payments in real-time
  const monitorPayments = () => {
    const db = getDatabase();
    const paymentsRef = ref(db, "payments/");

    onValue(paymentsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const statusObj = {};

        Object.keys(data).forEach((key) => {
          statusObj[data[key].bookingId] = data[key].status;

          // If payment status is "completed", process the payment automatically
          if (data[key].status === "completed" && !data[key].processed) {
            processCompletedPayment(data[key].bookingId, key);
          }
        });

        setPaymentStatus(statusObj);
      }
    });
  };

  // Process completed payments
  const processCompletedPayment = async (bookingId, paymentId) => {
    const db = getDatabase();
    const bookingRef = ref(db, `bookings/${bookingId}`);
    const paymentRef = ref(db, `payments/${paymentId}`);

    try {
      // Mark payment as processed
      await update(paymentRef, { processed: true });

      // Get the booking details before removing
      const snapshot = await get(bookingRef);
      if (snapshot.exists()) {
        const fulfilledBooking = snapshot.val();

        // Remove the booking
        await remove(bookingRef);

        // Update local state
        setBookings((prevBookings) =>
          prevBookings.filter((booking) => booking.id !== bookingId)
        );

        // Make the time slot available again
        updateTimeSlotAvailability(fulfilledBooking, true);

        // Notify users in queue about the available slot
        notifyUsersInQueue(fulfilledBooking);

        // Send completion notification to user
        if (fulfilledBooking.userId) {
          sendPaymentCompletionNotification(
            fulfilledBooking.userId,
            fulfilledBooking.email,
            fulfilledBooking.phoneNumber,
            bookingId
          );
        }

        console.log("Payment processed automatically for booking:", bookingId);
      }
    } catch (error) {
      console.error("Error processing payment:", error);
    }
  };

  // Send payment completion notification
  const sendPaymentCompletionNotification = async (
    userId,
    email,
    phoneNumber,
    bookingId
  ) => {
    const db = getDatabase();
    const notificationRef = ref(db, `notifications/${userId}`);
    const newNotification = {
      message: `Your payment for booking #${bookingId} has been processed successfully. Your charging slot is confirmed.`,
      timestamp: new Date().toISOString(),
      read: false,
    };

    try {
      // Add notification
      const userNotificationsRef = push(notificationRef);
      await set(userNotificationsRef, newNotification);

      // Send email notification if email exists
      if (email) {
        await sendEmailNotification(
          email,
          "Payment Successful - EV Charging Slot Confirmed",
          newNotification.message
        );
      }

      // Send SMS notification if phone number exists
      if (phoneNumber) {
        await sendSMSNotification(phoneNumber, newNotification.message);
      }
    } catch (error) {
      console.error("Error sending payment completion notification:", error);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    const db = getDatabase();
    const bookingRef = ref(db, `bookings/${bookingId}`);

    try {
      const snapshot = await get(bookingRef);
      if (snapshot.exists()) {
        const canceledBooking = snapshot.val();

        // Check if there's a payment associated with this booking
        const paymentsRef = ref(db, "payments/");
        const paymentsSnapshot = await get(paymentsRef);

        if (paymentsSnapshot.exists()) {
          const payments = paymentsSnapshot.val();
          const paymentId = Object.keys(payments).find(
            (key) => payments[key].bookingId === bookingId
          );

          if (paymentId) {
            // Delete the payment record
            await remove(ref(db, `payments/${paymentId}`));
          }
        }

        await remove(bookingRef);

        setBookings((prevBookings) =>
          prevBookings.filter((booking) => booking.id !== bookingId)
        );

        updateTimeSlotAvailability(canceledBooking, true);

        notifyUsersInQueue(canceledBooking);

        alert("Booking has been cancelled.");
      }
    } catch (error) {
      console.error("Error cancelling booking:", error);
    }
  };

  const updateTimeSlotAvailability = async (booking, isAvailable) => {
    const db = getDatabase();
    const { selectedLocation, vehicleType, chargingType, bookingTime } =
      booking;

    if (!bookingTime) {
      console.error("Missing booking time data:", booking);
      return;
    }

    const hourSlot = bookingTime.split(" ")[1];

    const slotRef = ref(
      db,
      `timeSlots/${selectedLocation}/${vehicleType}/${chargingType}/${hourSlot}`
    );

    try {
      // Update the slot availability
      await set(slotRef, isAvailable);

      // Update local state
      setTimeSlots((prev) => {
        const updated = JSON.parse(JSON.stringify(prev));
        if (!updated[selectedLocation]) {
          updated[selectedLocation] = {};
        }
        if (!updated[selectedLocation][vehicleType]) {
          updated[selectedLocation][vehicleType] = {};
        }
        if (!updated[selectedLocation][vehicleType][chargingType]) {
          updated[selectedLocation][vehicleType][chargingType] = {};
        }
        updated[selectedLocation][vehicleType][chargingType][hourSlot] =
          isAvailable;
        return updated;
      });
    } catch (error) {
      console.error("Error updating slot availability:", error);
    }
  };

  const notifyUsersInQueue = async (canceledBooking) => {
    const db = getDatabase();
    const { selectedLocation, vehicleType, chargingType, bookingTime } =
      canceledBooking;

    if (!bookingTime || typeof bookingTime !== "string") {
      console.error("Invalid or missing booking time:", canceledBooking);
      return;
    }

    // Extract start and end times from booking time
    const [startTime, endTime] = bookingTime.split("-").map((t) => t.trim());
    const startHour = parseInt(startTime.split(":")[0]);
    const endHour = parseInt(endTime.split(":")[0]);

    // Find the first eligible user in the queue
    const firstEligibleUser = queuedUsers.find((user) => {
      const locationMatch = user.preferredLocation === selectedLocation;
      const vehicleMatch = user.vehicleType === vehicleType;
      const chargingMatch = user.chargingType === chargingType;

      let timeMatch = false;
      if (user.preferredTime) {
        const [userStartTime, userEndTime] = user.preferredTime
          .split("-")
          .map((t) => t.trim());
        const userStartHour = parseInt(userStartTime.split(":")[0]);
        const userEndHour = parseInt(userEndTime.split(":")[0]);

        timeMatch =
          (startHour >= userStartHour && startHour < userEndHour) ||
          (endHour > userStartHour && endHour <= userEndHour);
      } else {
        timeMatch = true;
      }

      return locationMatch && vehicleMatch && chargingMatch && timeMatch;
    });

    if (firstEligibleUser) {
      console.log(`Notifying user ${firstEligibleUser.userId}`);

      const notificationRef = ref(
        db,
        `notifications/${firstEligibleUser.userId}`
      );
      const newNotification = {
        message: `A slot is now available at ${selectedLocation} for ${vehicleType} with ${chargingType} charging at ${bookingTime}!`,
        bookingDetails: {
          location: selectedLocation,
          vehicleType,
          chargingType,
          time: bookingTime,
        },
        timestamp: new Date().toISOString(),
        read: false,
      };

      try {
        const userNotificationsRef = push(notificationRef);
        await set(userNotificationsRef, newNotification);

        if (firstEligibleUser.userEmail) {
          await sendEmailNotification(
            firstEligibleUser.userEmail,
            "EV Charging Slot Available!",
            newNotification.message
          );
        }

        if (firstEligibleUser.phoneNumber) {
          await sendSMSNotification(
            firstEligibleUser.phoneNumber,
            newNotification.message
          );
        }

        const userQueueRef = ref(db, `queue/${firstEligibleUser.id}`);
        await remove(userQueueRef);
        console.log(`User ${firstEligibleUser.userId} removed from queue`);
      } catch (error) {
        console.error("Error sending notification:", error);
      }
    } else {
      console.log("No eligible users found for notifications");
    }
  };

  const sendEmailNotification = async (email, subject, message) => {
    const db = getDatabase();
    const emailNotificationsRef = ref(db, "emailNotifications");

    try {
      const newEmailNotification = {
        to: email,
        subject: subject,
        message: message,
        timestamp: new Date().toISOString(),
        status: "pending",
      };

      const newRef = await push(emailNotificationsRef, newEmailNotification);
      console.log(
        `Email notification queued for ${email} with reference ${newRef.key}`
      );
      return newRef.key;
    } catch (error) {
      console.error("Error sending email notification:", error);
      throw error;
    }
  };

  const sendSMSNotification = async (phoneNumber, message) => {
    const db = getDatabase();
    const smsNotificationsRef = ref(db, "smsNotifications");

    try {
      const newSMSNotification = {
        to: phoneNumber,
        message: message,
        timestamp: new Date().toISOString(),
        status: "pending",
      };

      const newRef = await push(smsNotificationsRef, newSMSNotification);
      console.log(
        `SMS notification queued for ${phoneNumber} with reference ${newRef.key}`
      );
      return newRef.key;
    } catch (error) {
      console.error("Error sending SMS notification:", error);
      throw error;
    }
  };

  // Generate payment QR code for a booking
  const generatePaymentQR = async (booking) => {
    const db = getDatabase();
    const bookingId = booking.id;
    const amount = calculateBillAmount(booking);

    // Create a payment record
    const paymentRef = ref(db, "payments");
    const newPayment = {
      bookingId: bookingId,
      amount: amount,
      timestamp: new Date().toISOString(),
      status: "pending",
      processed: false,
      userId: booking.userId || "unknown",
    };

    try {
      const paymentRecordRef = await push(paymentRef, newPayment);
      const paymentId = paymentRecordRef.key;

      // Generate payment details for QR code
      const paymentDetails = {
        paymentId: paymentId,
        bookingId: bookingId,
        amount: amount,
        description: `EV Charging at ${booking.selectedLocation} - ${booking.bookingTime}`,
        merchant: "EV Charging Network",
      };

      // Update booking with payment information
      const bookingRef = ref(db, `bookings/${bookingId}`);
      await update(bookingRef, { paymentId: paymentId });

      // Send QR code to user
      if (booking.email) {
        await sendPaymentQRToUser(booking.email, paymentDetails, booking);
      }

      // If user has a phone number, send SMS with payment link
      if (booking.phoneNumber) {
        const paymentLink = `https://evcharging.app/payment/${paymentId}`;
        await sendSMSNotification(
          booking.phoneNumber,
          `Your EV charging payment (${amount}) is pending. Pay here: ${paymentLink}`
        );
      }

      alert("Payment QR code has been sent to the user.");

      return paymentDetails;
    } catch (error) {
      console.error("Error generating payment QR:", error);
      throw error;
    }
  };

  // Send payment QR code to user via email
  const sendPaymentQRToUser = async (email, paymentDetails, booking) => {
    const db = getDatabase();
    const emailNotificationsRef = ref(db, "emailNotifications");

    try {
      // Create a QR code data URL
      const qrCodeData = JSON.stringify(paymentDetails);
      const paymentLink = `https://evcharging.app/payment/${paymentDetails.paymentId}`;

      const emailContent = `
        <h2>EV Charging Payment</h2>
        <p>Your booking at ${booking.selectedLocation} for ${booking.bookingTime} requires payment.</p>
        <p>Amount: ${paymentDetails.amount}</p>
        <p>Booking ID: ${booking.id}</p>
        <p>Please scan the QR code below to complete your payment or click the link: <a href="${paymentLink}">${paymentLink}</a></p>
        <p>Note: Your booking will be automatically confirmed once payment is complete.</p>
      `;

      const newEmailNotification = {
        to: email,
        subject: "Payment Required for EV Charging Booking",
        message: emailContent,
        attachments: [
          {
            type: "qrCode",
            data: qrCodeData,
            name: "payment_qr.png",
          },
        ],
        timestamp: new Date().toISOString(),
        status: "pending",
      };

      const newRef = await push(emailNotificationsRef, newEmailNotification);
      console.log(`Payment QR email queued for ${email}`);
      return newRef.key;
    } catch (error) {
      console.error("Error sending payment QR to user:", error);
      throw error;
    }
  };

  const handlePaymentConfirmation = async (bookingId) => {
    const db = getDatabase();
    const bookingRef = ref(db, `bookings/${bookingId}`);

    try {
      const snapshot = await get(bookingRef);
      if (snapshot.exists()) {
        const booking = snapshot.val();
        const paymentId = booking.paymentId;

        // If booking already has a payment ID, update its status
        if (paymentId) {
          const paymentRef = ref(db, `payments/${paymentId}`);
          await update(paymentRef, {
            status: "completed",
            completedAt: new Date().toISOString(),
          });
          alert(
            "Payment marked as completed. Booking will be processed automatically."
          );
        } else {
          // Manual payment confirmation without QR code
          const fulfilledBooking = {
            id: bookingId,
            ...booking,
          };

          // Remove the booking
          await remove(bookingRef);

          setBookings((prevBookings) =>
            prevBookings.filter((booking) => booking.id !== bookingId)
          );

          // Make the time slot available again
          updateTimeSlotAvailability(fulfilledBooking, true);

          // Notify users in queue about the available slot
          notifyUsersInQueue(fulfilledBooking);

          alert("Booking has been fulfilled.");
        }
      }
    } catch (error) {
      console.error("Error confirming payment:", error);
    }
  };

  const calculateBill = (booking) => {
    const amount = calculateBillAmount(booking);
    return `Rs ${amount}`;
  };

  const calculateBillAmount = (booking) => {
    if (booking.vehicleType === "two-wheeler") {
      return 40;
    } else if (booking.vehicleType === "four-wheeler") {
      return booking.chargingType === "AC" ? 40 : 400;
    }
    return 0;
  };

  const getHourFromBookingTime = (bookingTime) => {
    if (!bookingTime) return "Not specified";
    return bookingTime;
  };

  const handleLocationSelect = (location) => {
    setSelectedLocation(location === selectedLocation ? null : location);
  };

  // Filter bookings based on selected location
  const filteredBookings = selectedLocation
    ? bookings.filter(
        (booking) => booking.selectedLocation === selectedLocation
      )
    : bookings;

  return (
    <div
      className="relative flex items-center justify-center min-h-screen bg-cover"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="mx-auto max-w-4xl py-4 px-8 bg-white shadow-lg rounded-lg relative z-10">
        <div className="text-center mb-6">
          <p className="text-lg font-semibold">EV Charging Stations</p>
          <p className="text-sm text-gray-600">
            Users in queue: {queuedUsers.length}
          </p>
        </div>

        {/* Location selector */}
        <div className="mb-6">
          <h3 className="text-md font-medium mb-2">Select Location:</h3>
          <div className="flex flex-wrap gap-2">
            {locations.map((location) => (
              <button
                key={location}
                onClick={() => handleLocationSelect(location)}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  selectedLocation === location
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {location}
              </button>
            ))}
          </div>
        </div>

        {/* Location-specific availability */}
        {selectedLocation && (
          <div className="mb-6 p-4 bg-gray-50 rounded">
            <h3 className="text-md font-medium mb-2">
              Available Slots at {selectedLocation}:
            </h3>
            {Object.keys(timeSlots[selectedLocation] || {}).map(
              (vehicleType) => (
                <div key={vehicleType} className="mb-4">
                  <p className="font-medium text-sm">{vehicleType}:</p>
                  {Object.keys(
                    timeSlots[selectedLocation][vehicleType] || {}
                  ).map((chargingType) => (
                    <div key={chargingType} className="ml-4 mb-2">
                      <p className="text-sm">{chargingType} charging:</p>
                      <div className="flex flex-wrap ml-2">
                        {Object.keys(
                          timeSlots[selectedLocation][vehicleType][
                            chargingType
                          ] || {}
                        )
                          .slice(8, 20) // Show business hours 8:00 to 19:00
                          .map((hour) => (
                            <span
                              key={hour}
                              className={`text-xs m-1 px-2 py-1 rounded ${
                                timeSlots[selectedLocation][vehicleType][
                                  chargingType
                                ][hour]
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {hour}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {/* Bookings */}
        <div className="mb-6">
          <h3 className="text-md font-medium mb-2">
            {selectedLocation
              ? `Bookings at ${selectedLocation}`
              : "All Bookings"}
            :
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBookings.length > 0 ? (
              filteredBookings.map((booking) => (
                <div key={booking.id} className="p-6 bg-gray-100 rounded-lg">
                  <p className="text-xl font-bold mb-4">Booking Details:</p>
                  <p className="text-lg">
                    <strong>Name:</strong> {booking.name || "Not specified"}
                  </p>
                  <p className="text-lg">
                    <strong>Vehicle ID:</strong>{" "}
                    {booking.vehicleNumber || "Not specified"}
                  </p>
                  <p className="text-lg">
                    <strong>Location:</strong>{" "}
                    {booking.selectedLocation || "Not specified"}
                  </p>
                  <p className="text-lg">
                    <strong>Time Slot:</strong>{" "}
                    {getHourFromBookingTime(booking.bookingTime)}
                  </p>
                  <p className="text-lg">
                    <strong>Vehicle Type:</strong>{" "}
                    {booking.vehicleType || "Not specified"}
                  </p>
                  <p className="text-lg">
                    <strong>Charging Type:</strong>{" "}
                    {booking.chargingType || "Not specified"}
                  </p>
                  <p className="text-lg">Bill: {calculateBill(booking)}</p>
                  <p className="text-lg">
                    <strong>Payment Status:</strong>{" "}
                    <span
                      className={`font-medium ${
                        paymentStatus[booking.id] === "completed"
                          ? "text-green-600"
                          : paymentStatus[booking.id] === "pending"
                          ? "text-yellow-600"
                          : "text-gray-600"
                      }`}
                    >
                      {paymentStatus[booking.id]
                        ? paymentStatus[booking.id].charAt(0).toUpperCase() +
                          paymentStatus[booking.id].slice(1)
                        : "Not Started"}
                    </span>
                  </p>
                  <div className="flex flex-wrap justify-between items-center mt-4 gap-2">
                    <button
                      onClick={() => handleCancelBooking(booking.id)}
                      className="bg-red-500 text-white px-4 py-2 rounded-full hover:bg-red-600 focus:outline-none"
                    >
                      Cancel Booking
                    </button>

                    {!booking.paymentId && (
                      <button
                        onClick={() =>
                          generatePaymentQR({ ...booking, id: booking.id })
                        }
                        className="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 focus:outline-none"
                      >
                        Send Payment QR
                      </button>
                    )}

                    <button
                      onClick={() => handlePaymentConfirmation(booking.id)}
                      className="bg-green-500 text-white px-4 py-2 rounded-full hover:bg-green-600 focus:outline-none"
                    >
                      Mark as Paid
                    </button>
                  </div>

                  {booking.paymentId &&
                    paymentStatus[booking.id] === "pending" && (
                      <div className="mt-4 p-4 border rounded-lg bg-white">
                        <p className="text-sm text-center mb-2">
                          Payment QR (for testing)
                        </p>
                        <div className="flex justify-center">
                          <QRCodeCanvas
                            value={`https://evcharging.app/payment/${booking.paymentId}`}
                            size={120}
                          />
                        </div>
                      </div>
                    )}
                </div>
              ))
            ) : (
              <p className="col-span-2 text-center">
                {selectedLocation
                  ? `No bookings found for ${selectedLocation}.`
                  : "No bookings found."}
              </p>
            )}
          </div>
        </div>

        <div className="text-center my-4">
          <p className="text-sm text-gray-600">
            Notifications are sent automatically via email and SMS when slots
            become available
          </p>
        </div>
      </div>
    </div>
  );
}

export default Server;
