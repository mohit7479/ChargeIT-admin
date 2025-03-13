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
import bgImage from "../bg.jpg";
import app from "../firebase-config-database";

function Server() {
  const [bookings, setBookings] = useState([]);
  const [queuedUsers, setQueuedUsers] = useState([]);
  const [timeSlots, setTimeSlots] = useState({});

  useEffect(() => {
    initializeTimeSlots();
    checkBookings();
    monitorQueue();
  }, []);

  // Initialize time slots
  const initializeTimeSlots = async () => {
    const db = getDatabase();
    const slotsRef = ref(db, "timeSlots/");

    try {
      const snapshot = await get(slotsRef);
      if (snapshot.exists()) {
        setTimeSlots(snapshot.val());
      } else {
        const defaultTimeSlots = {};
        // Updated with more relevant locations based on the database screenshot
        const locations = ["EDAPALLY", "Location B"];
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
        console.log(queueList);
        setQueuedUsers(queueList);
      } else {
        setQueuedUsers([]);
      }
    });
  };

  const handleCancelBooking = async (bookingId) => {
    const db = getDatabase();
    const bookingRef = ref(db, `bookings/${bookingId}`);

    try {
      const snapshot = await get(bookingRef);
      if (snapshot.exists()) {
        const canceledBooking = snapshot.val();

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

    // Extract start and end times from "1:00 - 2:00"
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
        console.log(`Notification sent to user ${firstEligibleUser.userId}`);

        if (firstEligibleUser.userEmail) {
          await sendEmailNotification(
            firstEligibleUser.userEmail,
            newNotification.message,
            newNotification.bookingDetails
          );
        }

        if (firstEligibleUser.phoneNumber) {
          await sendSMSNotification("+9471945132", newNotification.message);
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

  // Improved email notification function
  const sendEmailNotification = async (email, message, bookingDetails) => {
    const db = getDatabase();
    const emailNotificationsRef = ref(db, "emailNotifications");

    try {
      // Create email notification record in the database
      // This would typically trigger a cloud function to send the actual email
      const newEmailNotification = {
        to: email,
        subject: "EV Charging Slot Available!",
        message: message,
        bookingDetails: bookingDetails,
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

  // Improved SMS notification function
  const sendSMSNotification = async (phoneNumber, message) => {
    const db = getDatabase();
    const smsNotificationsRef = ref(db, "smsNotifications");

    try {
      // Create SMS notification record in the database
      // This would typically trigger a cloud function to send the actual SMS
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

  const handlePaymentConfirmation = async (bookingId) => {
    const confirmation = window.confirm(
      "Confirm payment? This will remove the booking details."
    );

    if (confirmation) {
      const db = getDatabase();
      const bookingRef = ref(db, `bookings/${bookingId}`);

      try {
        // Get the booking details before removing
        const snapshot = await get(bookingRef);
        if (snapshot.exists()) {
          const fulfilledBooking = snapshot.val();

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

  const getDateFromBookingTime = (bookingTime) => {
    if (!bookingTime) return "Not specified";
    const parts = bookingTime.split("-");
    return parts[1]; // Returns the date part (DD/MM/YYYY)
  };

  const getHourFromBookingTime = (bookingTime) => {
    if (!bookingTime) return "Not specified";
    //const parts = bookingTime.split("-");
    return bookingTime; // Returns the hour part (HH:00)
  };

  const getAvailabilityStatus = (location, vehicleType, chargingType, hour) => {
    try {
      return timeSlots[location][vehicleType][chargingType][hour]
        ? "Available"
        : "Booked";
    } catch (error) {
      return "Unknown";
    }
  };

  return (
    <div
      className="relative flex items-center justify-center min-h-screen bg-cover"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="mx-auto max-w-4xl py-4 px-8 bg-white shadow-lg rounded-lg relative z-10">
        <div className="text-center mb-6">
          <p className="text-lg font-semibold">Our Bookings</p>
          <p className="text-sm text-gray-600">
            Users in queue: {queuedUsers.length}
          </p>
        </div>

        {/* Today's availability for quick reference */}
        <div className="mb-6 p-4 bg-gray-50 rounded">
          <h3 className="text-md font-medium mb-2">Today's Availability:</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.keys(timeSlots).length > 0 ? (
              Object.keys(timeSlots)
                .slice(0, 2)
                .map((location) => (
                  <div key={location} className="p-2 border rounded">
                    <p className="font-medium">{location}</p>
                    <div className="text-sm">
                      {Object.keys(timeSlots[location] || {}).map(
                        (vehicleType) => (
                          <div key={vehicleType} className="ml-2 mt-1">
                            <p className="font-medium">{vehicleType}:</p>
                            {Object.keys(
                              timeSlots[location][vehicleType] || {}
                            ).map((chargingType) => (
                              <div key={chargingType} className="ml-2">
                                <p>{chargingType} charging:</p>
                                <div className="flex flex-wrap ml-2">
                                  {Object.keys(
                                    timeSlots[location][vehicleType][
                                      chargingType
                                    ] || {}
                                  )
                                    .slice(8, 20) // Just show business hours 8:00 to 19:00
                                    .map((hour) => (
                                      <span
                                        key={hour}
                                        className={`text-xs m-1 px-2 py-1 rounded ${
                                          timeSlots[location][vehicleType][
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
                  </div>
                ))
            ) : (
              <p className="col-span-2 text-center">
                Loading availability data...
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {bookings.length > 0 ? (
            bookings.map((booking) => (
              <div key={booking.id} className="p-6 bg-gray-100 rounded-lg">
                <p className="text-xl font-bold mb-4">
                  We have a booking with:
                </p>
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
                </p>{" "}
                {/* <p className="text-lg">
                  // <strong>Date:</strong> //{" "}
                  {getDateFromBookingTime(booking.bookingTime)}
                  //{" "}
                </p> */}
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
