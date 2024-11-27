const Tag = require("../../Model/tagModel");

const addTag = async (req, res) => {
  try {
    const { name } = req.body;

    const existingTag = await Tag.findOne({ name });
    if (existingTag) {
      return res
        .status(409)
        .json({ message: "Tag with this name already exists." });
    }

    const newTag = new Tag({ name });
    await newTag.save();
    res.json({
      status: 201,
      message: "Tag added successfully",
      tag: newTag,
    });
  } catch (error) {
    res.json({
      status: 500,
      message: "Error adding tag",
      error: error.message,
    });
  }
};

const getAllTags = async (req, res) => {
  try {
    const { search, sortBy = "createdAt", order = "desc", active } = req.query;

    const query = {};

    // Adjust the condition to include all records when 'active' is 'all'
    if (active === "true") {
      query.active = true; // Only fetch active tags
    } else if (active === "false") {
      query.active = false; // Only fetch inactive tags
    }
    // If 'active' is 'all' or not provided, no filter is applied (this allows fetching all records)

    if (search) {
      query.name = new RegExp(search, "i"); // Search by name if provided
    }

    const totalTag = await Tag.countDocuments(query); // Count total tags matching the query
    const tags = await Tag.find(query).sort({
      [sortBy]: order === "asc" ? 1 : -1,
    });

    res.json({
      status: 200,
      tags,
      totalTag,
    });
  } catch (error) {
    res.json({
      status: 500,
      message: "Error fetching tags",
      error: error.message,
    });
  }
};


const getActiveTags = async (req, res) => {
  try {
    const { search, sortBy = "createdAt", order = "desc" } = req.query;

    const query = { active: true };

    if (search) {
      query.name = new RegExp(search, "i");
    }

    const totalActiveTags = await Tag.countDocuments(query);

    const activeTags = await Tag.find(query).sort({
      [sortBy]: order === "asc" ? 1 : -1,
    });

    res.json({
      status: 200,
      activeTags,
      totalActiveTags,
    });
  } catch (error) {
    res.json({
      status: 500,
      message: "Error fetching active tags",
      error: error.message,
    });
  }
};

const editTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const updatedTag = await Tag.findByIdAndUpdate(id, { name }, { new: true });
    res.json({
      status: 200,
      message: "Tag updated successfully",
      tag: updatedTag,
    });
  } catch (error) {
    res.json({
      status: 500,
      message: "Error updating tag",
      error: error.message,
    });
  }
};

const deleteTag = async (req, res) => {
  try {
    const { id } = req.params;
    await Tag.findByIdAndDelete(id);
    res.json({
      status: 200,
      message: "Tag deleted successfully",
    });
  } catch (error) {
    res.json({
      status: 500,
      message: "Error deleting tag",
      error: error.message,
    });
  }
};

const tagtoggleButton = async (req, res) => {
  console.log(`PATCH request received for tag ID: ${req.params.id}`);
  try {
    const tag = await Tag.findById(req.params.id);
    if (!tag) {
      return res.json({
        status: 404,
        message: "Tag not found",
      });
    }
    tag.active = !tag.active;
    await tag.save();
    res.json({
      status: 200,
      tag,
    });
  } catch (error) {
    console.error("Error toggling course:", error);
    res.json({
      status: 500,
      message: "Server error",
    });
  }
};

module.exports = {
  addTag,
  getAllTags,
  getActiveTags,
  editTag,
  deleteTag,
  tagtoggleButton,
};