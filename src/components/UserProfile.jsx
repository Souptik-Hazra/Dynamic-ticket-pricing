import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import "./UserProfile.css";

const UserProfile = () => {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
    city: user?.city || "",
    birthdate: user?.birthdate ? user.birthdate.substring(0, 10) : ""
  });
  const [icon, setIcon] = useState(user?.icon || defaultUserIcon);
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateUser(form);
      setMessage("Profile updated successfully!");
    } catch (err) {
      setMessage("Error updating profile.");
    }
  };

  return (
    <div className="user-profile-container">
      <h2>User Profile</h2>
      <img src={icon} alt="User Icon" className="user-icon" />
      <form onSubmit={handleSubmit} className="user-profile-form">
        <label>Name:</label>
        <input name="name" value={form.name} onChange={handleChange} />
        <label>Email:</label>
        <input name="email" value={form.email} onChange={handleChange} />
        <label>Password:</label>
        <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="New password (min 6 chars)" />
        <label>City:</label>
        <input name="city" value={form.city} onChange={handleChange} />
        <label>Birthdate:</label>
        <input name="birthdate" type="date" value={form.birthdate} onChange={handleChange} />
        <button type="submit">Update Profile</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default UserProfile;
