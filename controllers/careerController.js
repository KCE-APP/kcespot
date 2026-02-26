const Career = require("../models/Career");
const { optimizeImage } = require("../service/imageService");




exports.createCareer = async (req, res) => {
    try { 
        const entryData ={ ...req.body};

        if(req.file)
        {
            entryData.imageUrl=await optimizeImage(req.file.buffer,req.file.originalname);
        }

        const career = new Career(entryData);
        const savedcareer=await career.save();
        
        res.status(201).json({
            message:"Career created successfully",
            career:savedcareer
        })
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getCareers= async (req,res) =>{
    try{
        const {page=1,limit=10,search="",campus=""}=req.query;

        const query={isDeleted:false};

        if(search)
        {
            query.$or=[{title:{$regex:search,$options:"i"}},{campus:{$regex:search,$options:"i"}}];
        }

        if(campus)
        {
            query.campus = campus;
        }


        const count=await Career.countDocuments(query);
        const careers=await Career.find(query)
        .sort({createdAt:-1})
        .limit(limit*1)
        .skip((page-1)*limit);

        res.json({
            data:careers,
            totalPages:Math.ceil(count/limit),
            currentPage:Number(page),
            totalItems:count
        })
    }catch(error)
    {
        res.status(500).json({error:error.message});
    }
}


exports.getCareersforAdmin= async (req,res) =>{
    try{
        const {page=1,limit=10,search="",campus=""}=req.query;

        const query={isDeleted:false};

        if(search)
        {
            query.$or=[{title:{$regex:search,$options:"i"}},{campus:{$regex:search,$options:"i"}}];
        }

        if(campus)
        {
            query.campus = campus;
        }


        const count=await Career.countDocuments(query);
        const careers=await Career.find(query)
        .sort({createdAt:-1})
        .limit(limit*1)
        .skip((page-1)*limit);

        res.json({
            data:careers,
            totalPages:Math.ceil(count/limit),
            currentPage:Number(page),
            totalItems:count
        })
    }catch(error)
    {
        res.status(500).json({error:error.message});
    }
}


exports.updateCareer= async (req,res) =>{
    try{
        const {id}=req.params;
        const updateData={...req.body};

        if(req.file)
        {
            updateData.imageUrl=await optimizeImage(req.file.buffer,req.file.originalname);
        }

        const updated=await Career.findByIdAndUpdate(id,updateData,{new:true});
        res.json(updated);
    }catch(error)
    {
        res.status(500).json({error:error.message});
    }
}

exports.deleteCareer= async (req,res) =>{
    try{
        const {id}=req.params;
        await Career.findByIdAndUpdate(id,{isDeleted:true});
        res.json({message:"Career deleted successfully (Soft)"});
    }catch(error)
    {
        res.status(500).json({error:error.message});
    }
}