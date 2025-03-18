import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  getDatabase,
  ref,
  get,
  query,
  orderByChild,
  equalTo,
  push,
  set,
} from "firebase/database";
import { getAuth } from "firebase/auth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import {
  Clock,
  MapPin,
  Car,
  BatteryCharging,
  Calendar,
  Search,
  Mail,
  Users,
} from "lucide-react";

function Chatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isBookingSlot, setIsBookingSlot] = useState(false);
  const [isSearchingBookings, setIsSearchingBookings] = useState(false);
  const [isCheckingTimeSlot, setIsCheckingTimeSlot] = useState(false);
  const [searchStep, setSearchStep] = useState(0);
  const [checkTimeStep, setCheckTimeStep] = useState(0);
  const [bookingStep, setBookingStep] = useState(0);
  const [userEmail, setUserEmail] = useState(null);
  const [newBooking, setNewBooking] = useState({
    name: "",
    vehicleNumber: "",
    selectedLocation: "",
    vehicleType: "two-wheeler",
    chargingType: "AC",
    bookingTime: "",
  });
  const [searchCriteria, setSearchCriteria] = useState({
    stationName: "",
    userEmail: "",
  });
  const [timeSlotCheck, setTimeSlotCheck] = useState({
    stationName: "",
    timeSlot: "",
  });
  const [isCheckingStationBookings, setIsCheckingStationBookings] =
    useState(false);
  const [stationBookingStep, setStationBookingStep] = useState(0);
  const [stationToCheck, setStationToCheck] = useState("");
  const [timeRange, setTimeRange] = useState(""); // "hour" or "day"
  const locations = ["EDAPALLY", "FORT", "KALMASSERY", "VITYLLA"];
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserEmail(user.email);
      }
    });
    return unsubscribe;
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const generateTimeOptions = () => {
    const options = [];
    const currentHour = new Date().getHours();

    for (let hour = currentHour; hour < 24; hour++) {
      options.push(`${hour}:00 - ${hour + 1}:00`);
    }
    for (let hour = 0; hour < currentHour; hour++) {
      options.push(`${hour}:00 - ${hour + 1}:00 (next-day)`);
    }
    return options;
  };

  const fetchUserBookings = async () => {
    if (!userEmail) {
      setMessages((prev) => [
        ...prev,
        {
          text: "⚠️ Please sign in to view your bookings.",
          sender: "bot",
        },
      ]);
      return [];
    }

    const db = getDatabase();
    const bookingsRef = ref(db, "bookings");
    const userBookingsQuery = query(
      bookingsRef,
      orderByChild("userEmail"),
      equalTo(userEmail)
    );

    try {
      const snapshot = await get(userBookingsQuery);
      return snapshot.val() ? Object.values(snapshot.val()) : [];
    } catch (error) {
      console.error("Error fetching bookings:", error);
      return [];
    }
  };

  const searchBookingsByStationAndEmail = async (stationName, email) => {
    const db = getDatabase();
    const bookingsRef = ref(db, "bookings");

    try {
      // First filter by station
      const stationQuery = query(
        bookingsRef,
        orderByChild("selectedLocation"),
        equalTo(stationName.toUpperCase())
      );

      const snapshot = await get(stationQuery);
      if (!snapshot.exists()) {
        return [];
      }

      // Then filter results by email
      const results = Object.values(snapshot.val()).filter(
        (booking) =>
          booking.userEmail &&
          booking.userEmail.toLowerCase() === email.toLowerCase()
      );

      return results;
    } catch (error) {
      console.error("Error searching bookings:", error);
      return [];
    }
  };

  const countBookingsInTimeSlot = async (stationName, timeSlot) => {
    const db = getDatabase();
    const bookingsRef = ref(db, "bookings");

    try {
      // Query bookings by station
      const stationQuery = query(
        bookingsRef,
        orderByChild("selectedLocation"),
        equalTo(stationName.toUpperCase())
      );

      const snapshot = await get(stationQuery);
      if (!snapshot.exists()) {
        return 0;
      }

      // Filter and count bookings by time slot
      const bookingsInSlot = Object.values(snapshot.val()).filter(
        (booking) => booking.bookingTime === timeSlot
      );

      return bookingsInSlot.length;
    } catch (error) {
      console.error("Error counting bookings:", error);
      return 0;
    }
  };

  const validateBookingTime = async (location, time) => {
    const db = getDatabase();
    const bookingsRef = ref(db, "bookings");
    const locationQuery = query(
      bookingsRef,
      orderByChild("selectedLocation"),
      equalTo(location)
    );

    const snapshot = await get(locationQuery);
    if (snapshot.val()) {
      return !Object.values(snapshot.val()).some(
        (booking) => booking.bookingTime === time
      );
    }
    return true;
  };

  const handleSearchProcess = async (message) => {
    try {
      switch (searchStep) {
        case 0:
          if (locations.includes(message.toUpperCase())) {
            setSearchCriteria((prev) => ({
              ...prev,
              stationName: message.toUpperCase(),
            }));
            setMessages((prev) => [
              ...prev,
              {
                text: "📧 Please enter the user email to search for:",
                sender: "bot",
              },
            ]);
            setSearchStep(1);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                text: `📍 Please select a valid station name:\n${locations
                  .map((loc) => `• ${loc}`)
                  .join("\n")}`,
                sender: "bot",
              },
            ]);
          }
          break;

        case 1:
          if (message.includes("@") && message.includes(".")) {
            setSearchCriteria((prev) => ({ ...prev, userEmail: message }));

            // Perform the search
            const results = await searchBookingsByStationAndEmail(
              searchCriteria.stationName,
              message
            );

            if (results.length === 0) {
              setMessages((prev) => [
                ...prev,
                {
                  text: `🔍 No bookings found for email ${message} at station ${searchCriteria.stationName}.`,
                  sender: "bot",
                },
              ]);
            } else {
              const bookingsList = results
                .map(
                  (booking, index) =>
                    `📑 Booking #${index + 1}\n` +
                    `👤 Name: ${booking.name}\n` +
                    `🕒 Time: ${booking.bookingTime}\n` +
                    `🚗 Vehicle: ${booking.vehicleNumber}\n` +
                    `🔧 Type: ${booking.vehicleType}\n` +
                    `⚡ Charging: ${booking.chargingType}\n` +
                    "──────────────"
                )
                .join("\n\n");

              setMessages((prev) => [
                ...prev,
                {
                  text: `🔍 Bookings for ${message} at ${searchCriteria.stationName}:\n\n${bookingsList}`,
                  sender: "bot",
                },
              ]);
            }

            setIsSearchingBookings(false);
            setSearchStep(0);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                text: "⚠️ Please enter a valid email address.",
                sender: "bot",
              },
            ]);
          }
          break;
      }
    } catch (error) {
      console.error("Search error:", error);
      setMessages((prev) => [
        ...prev,
        {
          text: "❌ An error occurred during search. Please try again.",
          sender: "bot",
        },
      ]);
      setIsSearchingBookings(false);
      setSearchStep(0);
    }
  };

  const handleTimeSlotCheck = async (message) => {
    try {
      switch (checkTimeStep) {
        case 0:
          if (locations.includes(message.toUpperCase())) {
            setTimeSlotCheck((prev) => ({
              ...prev,
              stationName: message.toUpperCase(),
            }));
            setMessages((prev) => [
              ...prev,
              {
                text: "🕒 Please enter the time slot you want to check (e.g. '14:00 - 15:00'):",
                sender: "bot",
              },
            ]);
            setCheckTimeStep(1);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                text: `📍 Please select a valid station name:\n${locations
                  .map((loc) => `• ${loc}`)
                  .join("\n")}`,
                sender: "bot",
              },
            ]);
          }
          break;

        case 1:
          const timeSlots = generateTimeOptions();
          if (
            timeSlots.includes(message) ||
            message.match(/^\d{1,2}:\d{2} - \d{1,2}:\d{2}( \(next-day\))?$/)
          ) {
            setTimeSlotCheck((prev) => ({ ...prev, timeSlot: message }));

            // Count bookings in the time slot
            const count = await countBookingsInTimeSlot(
              timeSlotCheck.stationName,
              message
            );

            setMessages((prev) => [
              ...prev,
              {
                text: `📊 There are currently ${count} booking(s) for time slot ${message} at ${timeSlotCheck.stationName}.`,
                sender: "bot",
              },
            ]);

            setIsCheckingTimeSlot(false);
            setCheckTimeStep(0);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                text: "⚠️ Please enter a valid time slot in format 'HH:00 - HH:00'.",
                sender: "bot",
              },
            ]);
          }
          break;
      }
    } catch (error) {
      console.error("Time slot check error:", error);
      setMessages((prev) => [
        ...prev,
        {
          text: "❌ An error occurred checking the time slot. Please try again.",
          sender: "bot",
        },
      ]);
      setIsCheckingTimeSlot(false);
      setCheckTimeStep(0);
    }
  };

  const handleBookingProcess = async (message) => {
    if (!userEmail) {
      setMessages((prev) => [
        ...prev,
        {
          text: "⚠️ Please sign in to make a booking.",
          sender: "bot",
        },
      ]);
      setIsBookingSlot(false);
      return;
    }

    try {
      switch (bookingStep) {
        case 0:
          if (locations.includes(message.toUpperCase())) {
            setNewBooking((prev) => ({
              ...prev,
              selectedLocation: message.toUpperCase(),
              selectedAddress: message.toUpperCase(),
            }));
            setMessages((prev) => [
              ...prev,
              {
                text: "👤 Please enter your name:",
                sender: "bot",
              },
            ]);
            setBookingStep(1);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                text: `📍 Please select a valid location:\n${locations
                  .map((loc) => `• ${loc}`)
                  .join("\n")}`,
                sender: "bot",
              },
            ]);
          }
          break;

        case 1:
          if (message.trim()) {
            setNewBooking((prev) => ({ ...prev, name: message }));
            setMessages((prev) => [
              ...prev,
              {
                text: "🚗 Please enter your vehicle number:",
                sender: "bot",
              },
            ]);
            setBookingStep(2);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                text: "⚠️ Please enter a valid name.",
                sender: "bot",
              },
            ]);
          }
          break;

        case 2:
          const db = getDatabase();
          const vehicleQuery = query(
            ref(db, "bookings"),
            orderByChild("vehicleNumber"),
            equalTo(message.trim().toUpperCase())
          );
          const vehicleSnapshot = await get(vehicleQuery);

          if (vehicleSnapshot.val()) {
            setMessages((prev) => [
              ...prev,
              {
                text: "⚠️ This vehicle number already has a booking. Please use a different vehicle number.",
                sender: "bot",
              },
            ]);
            return;
          }

          setNewBooking((prev) => ({
            ...prev,
            vehicleNumber: message.trim().toUpperCase(),
          }));
          setMessages((prev) => [
            ...prev,
            {
              text: "🔧 Select vehicle type:\n• Type '2' for Two Wheeler 🏍️\n• Type '4' for Four Wheeler 🚗",
              sender: "bot",
            },
          ]);
          setBookingStep(3);
          break;

        case 3:
          if (message === "2" || message === "4") {
            const vehicleType =
              message === "2" ? "two-wheeler" : "four-wheeler";
            setNewBooking((prev) => ({ ...prev, vehicleType }));

            if (vehicleType === "four-wheeler") {
              setMessages((prev) => [
                ...prev,
                {
                  text: "⚡ Select charging type:\n• Type 'AC' for AC Charging\n• Type 'DC' for DC Charging",
                  sender: "bot",
                },
              ]);
              setBookingStep(4);
            } else {
              setMessages((prev) => [
                ...prev,
                {
                  text:
                    "🕒 Available time slots:\n" +
                    generateTimeOptions()
                      .map((slot) => `• ${slot}`)
                      .join("\n"),
                  sender: "bot",
                },
              ]);
              setBookingStep(5);
            }
          } else {
            setMessages((prev) => [
              ...prev,
              {
                text: "⚠️ Please enter either '2' for two-wheeler or '4' for four-wheeler",
                sender: "bot",
              },
            ]);
          }
          break;

        case 4:
          if (
            message.toUpperCase() === "AC" ||
            message.toUpperCase() === "DC"
          ) {
            setNewBooking((prev) => ({
              ...prev,
              chargingType: message.toUpperCase(),
            }));
            setMessages((prev) => [
              ...prev,
              {
                text:
                  "🕒 Available time slots:\n" +
                  generateTimeOptions()
                    .map((slot) => `• ${slot}`)
                    .join("\n"),
                sender: "bot",
              },
            ]);
            setBookingStep(5);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                text: "⚠️ Please enter either 'AC' or 'DC'",
                sender: "bot",
              },
            ]);
          }
          break;

        case 5:
          const timeSlots = generateTimeOptions();
          if (timeSlots.includes(message)) {
            const userBookings = await fetchUserBookings();
            if (userBookings.length >= 3) {
              setMessages((prev) => [
                ...prev,
                {
                  text: "⚠️ You have reached the maximum limit of 3 bookings.",
                  sender: "bot",
                },
              ]);
              setIsBookingSlot(false);
              setBookingStep(0);
              return;
            }

            const isTimeSlotAvailable = await validateBookingTime(
              newBooking.selectedLocation,
              message
            );

            if (!isTimeSlotAvailable) {
              setMessages((prev) => [
                ...prev,
                {
                  text: "⚠️ This time slot is already booked. Please select another time.",
                  sender: "bot",
                },
              ]);
              return;
            }

            const db = getDatabase();
            const bookingsRef = ref(db, "bookings");
            const newBookingRef = push(bookingsRef);

            const finalBooking = {
              ...newBooking,
              bookingTime: message,
              userEmail: userEmail,
            };

            await set(newBookingRef, finalBooking);

            setMessages((prev) => [
              ...prev,
              {
                text: `✅ Booking Confirmed!\n\n📍 Location: ${finalBooking.selectedLocation}\n👤 Name: ${finalBooking.name}\n🚗 Vehicle: ${finalBooking.vehicleNumber}\n🔧 Type: ${finalBooking.vehicleType}\n⚡ Charging: ${finalBooking.chargingType}\n🕒 Time: ${finalBooking.bookingTime}`,
                sender: "bot",
              },
            ]);

            setIsBookingSlot(false);
            setBookingStep(0);
            setNewBooking({
              name: "",
              vehicleNumber: "",
              selectedLocation: "",
              vehicleType: "two-wheeler",
              chargingType: "AC",
              bookingTime: "",
            });
          } else {
            setMessages((prev) => [
              ...prev,
              {
                text: "⚠️ Please select a valid time slot from the list above.",
                sender: "bot",
              },
            ]);
          }
          break;
      }
    } catch (error) {
      console.error("Booking error:", error);
      setMessages((prev) => [
        ...prev,
        {
          text: "❌ An error occurred during booking. Please try again.",
          sender: "bot",
        },
      ]);
      setIsBookingSlot(false);
      setBookingStep(0);
    }
  };

  const handleStationBookingsCheck = async (userInput) => {
    try {
      if (stationBookingStep === 0) {
        // First step: Validate station selection
        const selectedStation = userInput.trim().toUpperCase();
        if (
          !locations.map((loc) => loc.toUpperCase()).includes(selectedStation)
        ) {
          setMessages((prev) => [
            ...prev,
            {
              text: `❌ Invalid station. Please select from:\n${locations
                .map((loc) => `• ${loc}`)
                .join("\n")}`,
              sender: "bot",
            },
          ]);
          return;
        }

        setStationToCheck(selectedStation);
        setStationBookingStep(1);
        setMessages((prev) => [
          ...prev,
          {
            text: "⏰ Please choose the time period:\n• hour (for bookings in the past hour)\n• day (for bookings today)",
            sender: "bot",
          },
        ]);
        return;
      }

      if (stationBookingStep === 1) {
        // Second step: Validate time range
        const input = userInput.trim().toLowerCase();
        if (input !== "hour" && input !== "day") {
          setMessages((prev) => [
            ...prev,
            {
              text: "❌ Invalid time period. Please type 'hour' or 'day'.",
              sender: "bot",
            },
          ]);
          return;
        }

        setTimeRange(input);

        // Get current time for comparison
        const now = new Date();
        const currentHour = now.getHours();

        // Get bookings
        const db = getDatabase();
        const bookingsRef = ref(db, "bookings");
        const snapshot = await get(bookingsRef);

        let bookingsCount = 0;

        if (snapshot.exists()) {
          const allBookings = Object.values(snapshot.val());
          console.log("All bookings:", allBookings); // Debug log

          // Filter bookings by location and time
          const filteredBookings = allBookings.filter((booking) => {
            // Check if location matches (case insensitive)
            const locationMatch =
              (booking.selectedLocation &&
                booking.selectedLocation.toUpperCase() === stationToCheck) ||
              (booking.selectedAddress &&
                booking.selectedAddress.toUpperCase() === stationToCheck);

            if (!locationMatch) return false;

            // Extract the hour from bookingTime (format: "7:00 - 8:00")
            if (!booking.bookingTime) return false;

            // Parse the booking time to get the starting hour
            const bookingHourMatch = booking.bookingTime.match(/^(\d+):00/);
            if (!bookingHourMatch) return false;

            const bookingHour = parseInt(bookingHourMatch[1], 10);

            if (input === "hour") {
              // For "hour" option: Check if the booking hour matches the current hour
              return bookingHour === currentHour;
            } else if (input === "day") {
              // For "day" option: Include all bookings for today
              // All bookings are considered for today as we don't have date information
              return true;
            }

            return false;
          });

          bookingsCount = filteredBookings.length;
          console.log("Filtered bookings:", filteredBookings); // Debug log
        }

        const timeDescription = input === "hour" ? "past hour" : "today";

        setMessages((prev) => [
          ...prev,
          {
            text: `📊 Booking Statistics for ${stationToCheck}:\nTotal bookings in the ${timeDescription}: ${bookingsCount}`,
            sender: "bot",
          },
        ]);

        // Reset the state
        setIsCheckingStationBookings(false);
        setStationBookingStep(0);
        setStationToCheck("");
        setTimeRange("");
      }
    } catch (error) {
      console.error("Error checking station bookings:", error);
      setMessages((prev) => [
        ...prev,
        {
          text: "❌ Sorry, there was an error checking station bookings. Please try again.",
          sender: "bot",
        },
      ]);
      setIsCheckingStationBookings(false);
      setStationBookingStep(0);
    }
  };

  const handleViewBookings = async () => {
    const bookings = await fetchUserBookings();
    if (bookings.length === 0) {
      setMessages((prev) => [
        ...prev,
        {
          text: "📭 You have no current bookings.",
          sender: "bot",
        },
      ]);
    } else {
      const bookingsList = bookings
        .map(
          (booking, index) =>
            `📑 Booking #${index + 1}\n` +
            `📍 Location: ${booking.selectedLocation}\n` +
            `🕒 Time: ${booking.bookingTime}\n` +
            `🚗 Vehicle: ${booking.vehicleNumber}\n` +
            `🔧 Type: ${booking.vehicleType}\n` +
            `⚡ Charging: ${booking.chargingType}\n` +
            "──────────────"
        )
        .join("\n\n");

      setMessages((prev) => [
        ...prev,
        {
          text: "📋 Your Current Bookings:\n\n" + bookingsList,
          sender: "bot",
        },
      ]);
    }
  };

  const sendMessage = async (message) => {
    if (!message.trim()) return;

    setMessages((prev) => [...prev, { text: message, sender: "user" }]);
    setInput("");

    const lowerMessage = message.toLowerCase();

    // ✅ Exit Flow
    if (
      lowerMessage.includes("exit") ||
      lowerMessage.includes("stop") ||
      lowerMessage.includes("cancel") ||
      lowerMessage.includes("another function") ||
      lowerMessage.includes("switch function") ||
      lowerMessage.includes("different task")
    ) {
      stopAllProcesses();
      return;
    }

    // ✅ Handle Active Processes
    if (isBookingSlot) {
      await handleBookingProcess(message);
      return;
    }
    if (isSearchingBookings) {
      await handleSearchProcess(message);
      return;
    }
    if (isCheckingTimeSlot) {
      await handleTimeSlotCheck(message);
      return;
    }
    if (isCheckingStationBookings) {
      await handleStationBookingsCheck(message);
      return;
    }

    // ✅ Keyword-based Matching (Basic Fallback)
    if (lowerMessage.includes("book") && lowerMessage.includes("slot")) {
      startBookingProcess();
      return;
    }
    if (lowerMessage.includes("view") && lowerMessage.includes("booking")) {
      await handleViewBookings();
      return;
    }
    if (lowerMessage.includes("search") && lowerMessage.includes("booking")) {
      startSearchProcess();
      return;
    }
    if (lowerMessage.includes("check") && lowerMessage.includes("time slot")) {
      startTimeSlotCheck();
      return;
    }
    if (
      lowerMessage.includes("station") &&
      lowerMessage.includes("bookings") &&
      lowerMessage.includes("count")
    ) {
      startStationBookingCheck();
      return;
    }

    // ✅ Google Gemini AI for Intent Detection
    try {
      const response = await axios.post(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyBk71wWB363tGfFfscSXr-nZoX-lJCZbBE",
        {
          contents: [
            {
              parts: [
                {
                  text: `Classify the intent of the following message into one of these categories: 
                1. Book Slot 
                2. View Bookings 
                3. Search Bookings 
                4. Check Time Slot 
                5. Check Station Booking Count 
                6. General Conversation
                
                User message: "${message}"`,
                },
              ],
            },
          ],
        }
      );

      const botResponse =
        response.data.candidates?.[0]?.content?.parts?.[0]?.text || "unknown";

      // ✅ Process Gemini's Response
      if (botResponse.toLowerCase().includes("book slot")) {
        startBookingProcess();
        return;
      } else if (botResponse.toLowerCase().includes("view bookings")) {
        await handleViewBookings();
        return;
      } else if (botResponse.toLowerCase().includes("search bookings")) {
        startSearchProcess();
        return;
      } else if (botResponse.toLowerCase().includes("check time slot")) {
        startTimeSlotCheck();
        return;
      } else if (
        botResponse.toLowerCase().includes("check station booking count")
      ) {
        startStationBookingCheck();
        return;
      }

      // Default response if no intent is detected
      setMessages((prev) => [
        ...prev,
        {
          text: "I'm not sure what you mean. You can try:\n• 'Book slot' to make a booking\n• 'View bookings' to see your bookings\n• 'Search bookings' to find bookings\n• 'Check time slot' for availability",
          sender: "bot",
        },
      ]);
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          text: "⚠️ Sorry, I encountered an error. Try again later!",
          sender: "bot",
        },
      ]);
    }
  };

  // ✅ Stop All Processes
  const stopAllProcesses = () => {
    setIsBookingSlot(false);
    setIsSearchingBookings(false);
    setIsCheckingTimeSlot(false);
    setIsCheckingStationBookings(false);

    setMessages((prev) => [
      ...prev,
      { text: "✅ Booking process has been stopped.", sender: "bot" },
    ]);
  };

  // ✅ Helper Functions
  const startBookingProcess = () => {
    setIsBookingSlot(true);
    setBookingStep(0);
    setMessages((prev) => [
      ...prev,
      {
        text: `📍 Please select a location:\n${locations
          .map((loc) => `• ${loc}`)
          .join("\n")}`,
        sender: "bot",
      },
    ]);
  };

  const startSearchProcess = () => {
    setIsSearchingBookings(true);
    setSearchStep(0);
    setMessages((prev) => [
      ...prev,
      {
        text: `📍 Enter the charging station name to search:\n${locations
          .map((loc) => `• ${loc}`)
          .join("\n")}`,
        sender: "bot",
      },
    ]);
  };

  const startTimeSlotCheck = () => {
    setIsCheckingTimeSlot(true);
    setCheckTimeStep(0);
    setMessages((prev) => [
      ...prev,
      {
        text: `📍 Enter the charging station name to check availability:\n${locations
          .map((loc) => `• ${loc}`)
          .join("\n")}`,
        sender: "bot",
      },
    ]);
  };

  const startStationBookingCheck = () => {
    setIsCheckingStationBookings(true);
    setStationBookingStep(0);
    setMessages((prev) => [
      ...prev,
      {
        text: `📍 Enter the charging station name to check booking count:\n${locations
          .map((loc) => `• ${loc}`)
          .join("\n")}`,
        sender: "bot",
      },
    ]);
  };

  // const sendMessage = async (message) => {
  //   if (!message.trim()) return;

  //   setMessages((prev) => [...prev, { text: message, sender: "user" }]);
  //   setInput("");

  //   if (isBookingSlot) {
  //     await handleBookingProcess(message);
  //     return;
  //   }

  //   if (isSearchingBookings) {
  //     await handleSearchProcess(message);
  //     return;
  //   }

  //   if (isCheckingTimeSlot) {
  //     await handleTimeSlotCheck(message);
  //     return;
  //   }

  //   if (isCheckingStationBookings) {
  //     await handleStationBookingsCheck(message);
  //     return;
  //   }

  //   const lowerMessage = message.toLowerCase();
  //   if (lowerMessage === "book slot") {
  //     setIsBookingSlot(true);
  //     setBookingStep(0);
  //     setMessages((prev) => [
  //       ...prev,
  //       {
  //         text: `📍 Please select a location:\n${locations
  //           .map((loc) => `• ${loc}`)
  //           .join("\n")}`,
  //         sender: "bot",
  //       },
  //     ]);
  //     return;
  //   }

  //   if (lowerMessage === "view bookings") {
  //     await handleViewBookings();
  //     return;
  //   }

  //   if (lowerMessage === "search bookings") {
  //     setIsSearchingBookings(true);
  //     setSearchStep(0);
  //     setMessages((prev) => [
  //       ...prev,
  //       {
  //         text: `📍 Please enter the charging station name to search for:\n${locations
  //           .map((loc) => `• ${loc}`)
  //           .join("\n")}`,
  //         sender: "bot",
  //       },
  //     ]);
  //     return;
  //   }

  //   if (lowerMessage === "check time slot") {
  //     setIsCheckingTimeSlot(true);
  //     setCheckTimeStep(0);
  //     setMessages((prev) => [
  //       ...prev,
  //       {
  //         text: `📍 Please enter the charging station name to check:\n${locations
  //           .map((loc) => `• ${loc}`)
  //           .join("\n")}`,
  //         sender: "bot",
  //       },
  //     ]);
  //     return;
  //   }

  //   if (lowerMessage === "station bookings count") {
  //     setIsCheckingStationBookings(true);
  //     setStationBookingStep(0);
  //     setMessages((prev) => [
  //       ...prev,
  //       {
  //         text: `📍 Please enter the charging station name to check booking count:\n${locations
  //           .map((loc) => `• ${loc}`)
  //           .join("\n")}`,
  //         sender: "bot",
  //       },
  //     ]);
  //     return;
  //   }

  //   if (lowerMessage === "book slot") {
  //     setIsBookingSlot(true);
  //     setBookingStep(0);
  //     setMessages((prev) => [
  //       ...prev,
  //       {
  //         text: `📍 Please select a location:\n${locations
  //           .map((loc) => `• ${loc}`)
  //           .join("\n")}`,
  //         sender: "bot",
  //       },
  //     ]);
  //     return;
  //   }

  //   try {
  //     const response = await axios.post(
  //       `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.REACT_APP_API_KEY}`,
  //       {
  //         contents: [{ parts: [{ text: message }] }],
  //       }
  //     );

  //     const botResponse =
  //       response.data.candidates?.[0]?.content?.parts?.[0]?.text ||
  //       "I couldn't process that request. You can try:\n• Type 'book slot' to make a booking\n• Type 'view bookings' to see your current bookings\n• Type 'search bookings' to find bookings by station and email\n• Type 'check time slot' to see bookings in a specific time slot";

  //     setMessages((prev) => [...prev, { text: botResponse, sender: "bot" }]);
  //   } catch (error) {
  //     console.error("Error:", error);
  //     setMessages((prev) => [
  //       ...prev,
  //       {
  //         text: "Sorry, I encountered an error. You can:\n• Type 'book slot' to make a booking\n• Type 'view bookings' to see your bookings\n• Type 'search bookings' to find bookings by station and email\n• Type 'check time slot' to see bookings in a specific time slot",
  //         sender: "bot",
  //       },
  //     ]);
  //   }
  // };

  return (
    <div className="flex flex-col items-center h-screen bg-gradient-to-br from-green-100 via-green-200 to-green-300">
      <div className="flex flex-col w-full max-w-md p-4 bg-white/90 shadow-lg rounded-lg mt-10 mb-4 space-y-4 overflow-auto h-3/4">
        <div className="bg-green-600 text-white p-4 rounded-lg shadow-md mb-4">
          <h1 className="text-xl font-bold text-center flex items-center justify-center gap-2">
            <BatteryCharging className="w-6 h-6" />
            EV Charging Assistant
          </h1>
        </div>

        <div className="flex flex-col space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`max-w-[80%] p-4 rounded-xl shadow-md ${
                message.sender === "user"
                  ? "bg-green-500 text-white self-end rounded-br-none"
                  : "bg-white text-gray-800 self-start rounded-bl-none"
              }`}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  code: ({ node, inline, className, children, ...props }) => (
                    <code style={{ backgroundColor: "lightgray" }} {...props}>
                      {children}
                    </code>
                  ),
                }}
              >
                {message.text}
              </ReactMarkdown>
            </div>
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>

      <div className="flex w-full max-w-md p-3 bg-white/95 rounded-lg shadow-lg space-x-2 items-center mb-6">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
          className="w-full p-4 text-lg text-gray-800 border-2 border-green-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Type your message..."
        />
        <button
          onClick={() => sendMessage(input)}
          className="p-4 text-white bg-green-600 rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors duration-200"
        >
          Send
        </button>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap justify-center gap-4 mb-6">
        <button
          onClick={() => sendMessage("book slot")}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
        >
          <Calendar className="w-4 h-4" />
          Book Slot
        </button>
        <button
          onClick={() => sendMessage("view bookings")}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
        >
          <Clock className="w-4 h-4" />
          View Bookings
        </button>
        <button
          onClick={() => sendMessage("search bookings")}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
        >
          <Search className="w-4 h-4" />
          Search Bookings
        </button>
        <button
          onClick={() => sendMessage("check time slot")}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
        >
          <Users className="w-4 h-4" />
          Check Time Slot
        </button>
      </div>
    </div>
  );
}

export default Chatbot;
