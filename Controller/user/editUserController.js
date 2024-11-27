const userModel = require("../../Model/userModel");

const editUser = async (req, res) => {
  console.log("Request Body:", req.body);
  const { userId, name, email, phoneNumber } = req.body;

  console.log("User ID:", userId);
  console.log("Update Data:", { name, email, phoneNumber });

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const updatedUser = await userModel.findOneAndUpdate(
      { _id: userId },
      { name, email, phoneNumber },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User updated successfully", updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const deletedUser = await userModel.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = { editUser, deleteUser };
