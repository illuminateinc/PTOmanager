import { useState, useMemo, useRef, useCallback } from "react";
import * as XLSX from "xlsx";

// ─── Real Employee Data ────────────────────────────────────────────────────────
// accrualRate = hours per pay period | 24 pay periods/year
// 5 hrs × 24 = 120 hrs = 15 days/yr | 3.33 hrs × 24 = ~80 hrs = ~10 days/yr
// `used` is NOT stored here — it is computed live from approved requests below
const SEED_EMPLOYEES = [
  { id:1,  name:"Maria Bocanegra",      role:"Manager",  department:"Project Management", startDate:"2022-05-02", accrualRate:5.00, vacation:{total:15},  sick:{total:5}, personal:{total:2}, floatHoliday:{total:1} },
  { id:2,  name:"Carly Commiso",        role:"Manager",  department:"Learning Strategy",  startDate:"2022-11-21", accrualRate:5.00, vacation:{total:15},  sick:{total:5}, personal:{total:2}, floatHoliday:{total:1} },
  { id:3,  name:"Faridon Dadrass",      role:"Manager",  department:"Learning Tech",      startDate:"2019-12-16", accrualRate:5.00, vacation:{total:15},  sick:{total:5}, personal:{total:2}, floatHoliday:{total:1} },
  { id:4,  name:"Kristian Dawes",       role:"Employee", department:"Learning Tech",      startDate:"2024-01-22", accrualRate:3.33, vacation:{total:10},  sick:{total:5}, personal:{total:2}, floatHoliday:{total:1} },
  { id:5,  name:"Kara Fitzgibbon",      role:"Employee", department:"BDEV",               startDate:"2019-09-09", accrualRate:5.00, vacation:{total:15},  sick:{total:5}, personal:{total:2}, floatHoliday:{total:1} },
  { id:6,  name:"Daniel Goldsmith",     role:"Employee", department:"Project Management", startDate:"2019-07-22", accrualRate:5.00, vacation:{total:15},  sick:{total:5}, personal:{total:2}, floatHoliday:{total:1} },
  { id:7,  name:"William Hwang",        role:"Employee", department:"Learning Strategy",  startDate:"2021-07-19", accrualRate:5.00, vacation:{total:15},  sick:{total:5}, personal:{total:2}, floatHoliday:{total:1} },
  { id:9,  name:"Sarah Looney",         role:"Employee", department:"Project Management", startDate:"2023-07-15", accrualRate:5.00, vacation:{total:13.5},sick:{total:5}, personal:{total:2}, floatHoliday:{total:1} },
  { id:11, name:"Nathanael Otanez",     role:"Employee", department:"Project Management", startDate:"2023-06-20", accrualRate:5.00, vacation:{total:12.5},sick:{total:5}, personal:{total:2}, floatHoliday:{total:1} },
  { id:12, name:"Prasanna Ranade",      role:"Employee", department:"Graphic Design",     startDate:"2023-01-09", accrualRate:5.00, vacation:{total:15},  sick:{total:5}, personal:{total:2}, floatHoliday:{total:1} },
  { id:13, name:"Rich Daley",           role:"Employee", department:"Graphic Design",     startDate:"2024-10-28", accrualRate:3.33, vacation:{total:10},  sick:{total:5}, personal:{total:2}, floatHoliday:{total:1} },
  { id:14, name:"Janiel Rosario",       role:"Employee", department:"Project Management", startDate:"2026-02-01", accrualRate:3.33, vacation:{total:10},  sick:{total:5}, personal:{total:2}, floatHoliday:{total:1} },
  { id:15, name:"Farheen Shaikh",       role:"Employee", department:"MR",                 startDate:"2025-07-01", accrualRate:3.33, vacation:{total:10},  sick:{total:5}, personal:{total:2}, floatHoliday:{total:1} },
  { id:16, name:"Vrushali Nar",         role:"Employee", department:"eLearning",           startDate:"2025-08-01", accrualRate:3.33, vacation:{total:10},  sick:{total:5}, personal:{total:2}, floatHoliday:{total:1} },
  { id:10, name:"Shaun McMahon",        role:"Manager",  department:"Project Management", startDate:"2005-04-13", accrualRate:5.00, vacation:{total:15},  sick:{total:5}, personal:{total:2}, floatHoliday:{total:1} },
  { id:19, name:"Juan Carlos Pinedo",   role:"Employee", department:"Learning Tech",      startDate:"2006-12-15", accrualRate:5.00, vacation:{total:15},  sick:{total:5}, personal:{total:2}, floatHoliday:{total:1} },
  { id:18, name:"Mason Jones",          role:"Employee", department:"BDEV", startDate:"2026-04-01", accrualRate:3.33, vacation:{total:10},  sick:{total:5}, personal:{total:2}, floatHoliday:{total:1} },
];

// ─── Requests — source of truth for all used days ─────────────────────────────
// NOTE: used days are ALWAYS computed as sum of approved requests.
// Rollover days (removed from totals) are excluded — those dates are not tracked here.
const SEED_REQUESTS = [
  // Maria — vacation Mar 30–Apr 3 (5 days) from spreadsheet
  { id:1,  employeeId:1,  employeeName:"Maria Bocanegra",  bucket:"vacation",     from:"2026-03-30", to:"2026-04-03", days:5, status:"approved", note:"", source:"manual" },
  // Carly — vacation Mar 20 (1 day) from spreadsheet
  { id:2,  employeeId:2,  employeeName:"Carly Commiso",    bucket:"vacation",     from:"2026-03-20", to:"2026-03-20", days:1, status:"approved", note:"", source:"manual" },
  // Kara — sick Mar 2 (1 day) from spreadsheet
  { id:4,  employeeId:5,  employeeName:"Kara Fitzgibbon",  bucket:"sick",         from:"2026-03-02", to:"2026-03-02", days:1, status:"approved", note:"", source:"manual" },
  // Daniel — Apr 20 vacation (PDF approved), May 1 & May 4 from spreadsheet
  { id:5,  employeeId:6,  employeeName:"Daniel Goldsmith", bucket:"vacation",     from:"2026-04-20", to:"2026-04-20", days:1, status:"approved", note:"Mgr signed 4/7/26", source:"pdf" },
  { id:6,  employeeId:6,  employeeName:"Daniel Goldsmith", bucket:"vacation",     from:"2026-05-01", to:"2026-05-01", days:1, status:"approved", note:"", source:"manual" },
  { id:7,  employeeId:6,  employeeName:"Daniel Goldsmith", bucket:"vacation",     from:"2026-05-04", to:"2026-05-04", days:1, status:"approved", note:"", source:"manual" },
  // William — 3 sick days from Feb 27 (spreadsheet: sick balance 5→2)
  { id:8,  employeeId:7,  employeeName:"William Hwang",    bucket:"sick",         from:"2026-02-27", to:"2026-03-01", days:3, status:"approved", note:"", source:"manual" },
  // William — vacation Apr 23–24 (PDF, approved by Carolyn Commiso 4/17/26)
  { id:13, employeeId:7,  employeeName:"William Hwang",    bucket:"vacation",     from:"2026-04-23", to:"2026-04-24", days:2, status:"approved", note:"Mgr: Carolyn Commiso 4/17/26", source:"pdf" },
  // Maria — floating holiday May 29 (1 day, mgr signed 4/25/26)
  { id:16, employeeId:1,  employeeName:"Maria Bocanegra", bucket:"floatHoliday", from:"2026-05-29", to:"2026-05-29", days:1,   status:"approved", note:"", source:"pdf" },
  // Carly — personal half-day Apr 30 (0.5 days, mgr signed 4/28/26)
  { id:17, employeeId:2,  employeeName:"Carly Commiso",   bucket:"personal",     from:"2026-04-30", to:"2026-04-30", days:0.5, status:"approved", note:"Half day", source:"pdf" },
  // Sarah — vacation Jul 8–15 (6 business days, return Jul 16, mgr signed ~5/23/26)
  { id:18, employeeId:9,  employeeName:"Sarah Looney",    bucket:"vacation",     from:"2026-07-08", to:"2026-07-15", days:6,   status:"approved", note:"", source:"pdf" },
  // Sarah — vacation Sep 10–11 (2 business days, return Sep 14, mgr signed ~5/23/26)
  { id:19, employeeId:9,  employeeName:"Sarah Looney",    bucket:"vacation",     from:"2026-09-10", to:"2026-09-11", days:2,   status:"approved", note:"", source:"pdf" },
  { id:14, employeeId:1,  employeeName:"Maria Bocanegra",  bucket:"vacation", from:"2026-06-12", to:"2026-06-22", days:5, status:"approved", note:"", source:"pdf" },
  // Kara — vacation Jul 9–15 2026, returns Jul 16 (5 business days, PDF approved)
  { id:15, employeeId:5,  employeeName:"Kara Fitzgibbon",  bucket:"vacation", from:"2026-07-09", to:"2026-07-15", days:5, status:"approved", note:"", source:"pdf" },
  { id:10, employeeId:9,  employeeName:"Sarah Looney",     bucket:"vacation",     from:"2026-02-27", to:"2026-02-27", days:1, status:"approved", note:"", source:"manual" },
  // Rich — sick Feb 24 (1 day) from spreadsheet
  { id:11, employeeId:13, employeeName:"Rich Daley",       bucket:"sick",         from:"2026-02-24", to:"2026-02-24", days:1, status:"approved", note:"", source:"manual" },
  // Janiel — sick Feb 20 (1 day) from spreadsheet
  { id:12, employeeId:14, employeeName:"Janiel Rosario",   bucket:"sick",         from:"2026-02-20", to:"2026-02-20", days:1, status:"approved", note:"", source:"manual" },
];

const BUCKETS = [
  { key:"vacation",     label:"Vacation",        color:"#009cbd", bg:"#e5f5fa", light:"#b3e0ee" },
  { key:"sick",         label:"Sick Days",        color:"#006d82", bg:"#e0f2f6", light:"#9fd5de" },
  { key:"personal",     label:"Personal Days",    color:"#b08a00", bg:"#fff8d6", light:"#ffe97a" },
  { key:"floatHoliday", label:"Floating Holiday", color:"#333333", bg:"#f0f0f0", light:"#d0d0d0" },
];

const TEAMS = ["All","Project Management","Learning Strategy","Learning Tech","BDEV","Graphic Design","MR","eLearning"];
const ROLES = ["All","Manager","Employee"];
const ACCRUALS = ["Monthly","Biweekly","Annual","Quarterly"];
const STATUS_META = {
  pending:  { bg:"#FFF8E7", text:"#B76E00", dot:"#ffd000" },
  approved: { bg:"#E8F5EE", text:"#006d82", dot:"#009cbd" },
  denied:   { bg:"#FEECEC", text:"#C0392B", dot:"#E74C3C" },
};
// ─── Policy Constants ─────────────────────────────────────────────────────────
const POLICY = {
  vacationAccrualCapDays:   15,       // accrual pauses at 15 days
  vacationAccrualStartMo:   6,        // vacation accrual starts 6 months after hire
  otherEligibleDays:        90,       // sick/personal/float usable after 90 days
  maxRolloverDays:          5,        // max vacation days that roll over
  rolloverExpiryMonth:      2,        // 0-indexed: March = 2 (expires end of March)
  payPeriodsPerYear:        24,       // semi-monthly (15th & last day of month)
  vacationCanGoNegative:    true,
  floatHolidayDeadline:     "Dec 31",
  businessDaysOnly:         true,
};

const HUES = ["#009cbd","#006d82","#009cbd","#b08a00","#009cbd","#333333","#333333","#333333"];
const avC  = n=>{ let h=0; for(const c of n) h=(h*31+c.charCodeAt(0))%HUES.length; return HUES[h]; };
const ini  = n=>n.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
const fd   = s=>new Date(s+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
const fmt  = n=>Number.isInteger(n)?n:+n.toFixed(1);

// Count business days (Mon–Fri) only between two date strings inclusive
function dbw(from, to) {
  let count=0;
  const cur=new Date(from+"T00:00:00"), end=new Date(to+"T00:00:00");
  while(cur<=end){ const d=cur.getDay(); if(d!==0&&d!==6) count++; cur.setDate(cur.getDate()+1); }
  return Math.max(1,count);
}

// Days since a date string
const daysSince  = s=>Math.floor((new Date()-new Date(s+"T00:00:00"))/86400000);
const monthsSince= s=>{ const d=new Date(s); const n=new Date(); return (n.getFullYear()-d.getFullYear())*12+(n.getMonth()-d.getMonth()); };

// Eligibility checks
const vacationAccrualEligible  = e => monthsSince(e.startDate) >= POLICY.vacationAccrualStartMo;
const otherBucketsEligible     = e => daysSince(e.startDate)   >= POLICY.otherEligibleDays;

// Compute used days live from approved requests — single source of truth
const usedDays = (empId, bucket, reqs) =>
  reqs.filter(r=>r.employeeId===empId&&r.bucket===bucket&&r.status==="approved")
      .reduce((s,r)=>s+r.days, 0);

// Accrual paused when vacation balance >= cap
const accrualPaused = (empId, emp, reqs) => {
  const used=usedDays(empId,"vacation",reqs);
  return (emp.vacation.total - used) >= POLICY.vacationAccrualCapDays;
};

const IS   = { width:"100%",padding:"9px 13px",borderRadius:9,border:"1px solid #DDD9D0",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box",background:"#f5fbfc" };
const LS   = { display:"block",fontSize:11,fontWeight:600,color:"#888",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em" };
const mkB  = ()=>({ vacation:{total:15},sick:{total:5},personal:{total:2},floatHoliday:{total:1} });

async function parsePTOPdf(base64Data, employees) {
  const empList = employees.map(e=>e.name).join(", ");
  const res = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      model:"claude-sonnet-4-20250514",max_tokens:1000,
      messages:[{role:"user",content:[
        {type:"document",source:{type:"base64",media_type:"application/pdf",data:base64Data}},
        {type:"text",text:`Parse this PTO request form. Known employees: ${empList}\n\nReturn ONLY JSON:\n{"employeeName":"...","matchedEmployee":"best match or null","bucket":"vacation|sick|personal|floatHoliday","from":"YYYY-MM-DD","to":"YYYY-MM-DD","days":N,"note":"...","confidence":"high|medium|low","warnings":[]}\n\nBucket rules: sick/medical/illness→sick, personal/family→personal, float/comp→floatHoliday, vacation/bereavement/other→vacation`}
      ]}]
    })
  });
  const data=await res.json();
  const raw=data.content?.find(b=>b.type==="text")?.text||"";
  return JSON.parse(raw.replace(/```json|```/g,"").trim());
}

export default function App() {
  const [employees,  setEmployees]  = useState(SEED_EMPLOYEES);
  const [requests,   setRequests]   = useState(SEED_REQUESTS);
  const [tab,        setTab]        = useState("employees");
  const [teamF,      setTeamF]      = useState("All");
  const [roleF,      setRoleF]      = useState("All");
  const [statusF,    setStatusF]    = useState("all");
  const [bucketF,    setBucketF]    = useState("all");
  const [search,     setSearch]     = useState("");
  const [modal,      setModal]      = useState(null);
  const [detailEmp,  setDetailEmp]  = useState(null);
  const [bonusInput, setBonusInput] = useState("");
  const [importRows, setImportRows] = useState([]);
  const [importErr,  setImportErr]  = useState("");
  const [nRId,       setNRId]       = useState(50);
  const [nEId,       setNEId]       = useState(50);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfResult,  setPdfResult]  = useState(null);
  const [pdfError,   setPdfError]   = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileRef    = useRef();
  const pdfDropRef = useRef();

  const [nReq, setNReq] = useState({employeeId:"",bucket:"vacation",from:"",to:"",note:""});
  const [nEmp, setNEmp] = useState({name:"",role:"Employee",department:"Project Management",startDate:"",accrualRate:3.33,...mkB()});

  const stats = useMemo(()=>{
    const today=new Date().toISOString().split("T")[0];
    return {
      total:    employees.length,
      pending:  requests.filter(r=>r.status==="pending").length,
      onLeave:  requests.filter(r=>r.status==="approved"&&r.from<=today&&r.to>=today).length,
      appMonth: requests.filter(r=>{const m=new Date().getMonth();return r.status==="approved"&&new Date(r.from).getMonth()===m;}).length,
    };
  },[employees,requests]);

  const filtEmps = useMemo(()=>employees.filter(e=>
    (teamF==="All"||e.department===teamF)&&
    (roleF==="All"||e.role===roleF)&&
    (e.name.toLowerCase().includes(search.toLowerCase())||e.department.toLowerCase().includes(search.toLowerCase()))
  ),[employees,teamF,roleF,search]);

  const filtReqs = useMemo(()=>requests.filter(r=>
    (statusF==="all"||r.status===statusF)&&
    (bucketF==="all"||r.bucket===bucketF)&&
    r.employeeName.toLowerCase().includes(search.toLowerCase())
  ).sort((a,b)=>new Date(b.from)-new Date(a.from)),[requests,statusF,bucketF,search]);

  function handleAction(id,action){
    setRequests(prev=>prev.map(r=>{
      if(r.id!==id) return r;
      if(action==="approve") return{...r,status:"approved"};
      return{...r,status:"denied"};
    }));
  }

  function submitReq(){
    const emp=employees.find(e=>e.id===parseInt(nReq.employeeId));
    if(!emp||!nReq.from||!nReq.to) return;
    const days=dbw(nReq.from,nReq.to);
    setRequests(p=>[{id:nRId,employeeId:emp.id,employeeName:emp.name,bucket:nReq.bucket,from:nReq.from,to:nReq.to,days,status:"pending",note:nReq.note,source:"manual"},...p]);
    setNRId(n=>n+1);setNReq({employeeId:"",bucket:"vacation",from:"",to:"",note:""});setModal(null);
  }

  function submitEmp(){
    if(!nEmp.name||!nEmp.role) return;
    setEmployees(p=>[...p,{...nEmp,id:nEId,
      vacation:{total:+nEmp.vacation.total||0},
      sick:{total:+nEmp.sick.total||0},
      personal:{total:+nEmp.personal.total||0},
      floatHoliday:{total:+nEmp.floatHoliday.total||0},
    }]);
    setNEId(n=>n+1);
    setNEmp({name:"",role:"Employee",department:"Project Management",startDate:"",accrualRate:3.33,...mkB()});setModal(null);
  }

  function handleXlsxFile(e){
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=evt=>{
      try{
        const wb=XLSX.read(evt.target.result,{type:"binary"});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws,{defval:""});
        const parsed=[],errs=[];
        rows.forEach((row,i)=>{
          const name=String(row["Name"]||"").trim(),role=String(row["Role"]||"").trim();
          if(!name||!role){errs.push(`Row ${i+2}: missing Name/Role`);return;}
          parsed.push({name,role,department:String(row["Department"]||"").trim(),startDate:String(row["Start Date"]||"").trim(),accrualRate:+row["Accrual Rate"]||3.33,
            vacation:{total:+row["Vacation Total"]||0},
            sick:{total:+row["Sick Total"]||0},
            personal:{total:+row["Personal Total"]||0},
            floatHoliday:{total:+row["Float Holiday Total"]||0},
          });
        });
        setImportErr(errs.length?errs.slice(0,3).join(" · ")+(errs.length>3?` +${errs.length-3} more`:""):"");
        setImportRows(parsed);e.target.value="";
      }catch{setImportErr("Could not parse file.");}
    };
    reader.readAsBinaryString(file);
  }

  function confirmImport(){
    const added=importRows.map((r,i)=>({...r,id:nEId+i}));
    setEmployees(p=>[...p,...added]);setNEId(n=>n+importRows.length);
    setImportRows([]);setImportErr("");setModal(null);
  }

  const processPdfFile=useCallback(async(file)=>{
    if(!file||file.type!=="application/pdf"){setPdfError("Please drop a PDF file.");return;}
    setPdfParsing(true);setPdfError("");setPdfResult(null);setModal("pdf");
    const reader=new FileReader();
    reader.onload=async evt=>{
      try{const base64=evt.target.result.split(",")[1];setPdfResult(await parsePTOPdf(base64,employees));}
      catch{setPdfError("Could not parse the PDF.");}
      finally{setPdfParsing(false);}
    };
    reader.readAsDataURL(file);
  },[employees]);

  function handlePdfInputChange(e){processPdfFile(e.target.files[0]);e.target.value="";}

  const onDragOver =useCallback(e=>{e.preventDefault();setIsDragging(true);},[]);
  const onDragLeave=useCallback(e=>{if(!e.currentTarget.contains(e.relatedTarget))setIsDragging(false);},[]);
  const onDrop     =useCallback(e=>{e.preventDefault();setIsDragging(false);const f=e.dataTransfer.files[0];if(f?.type==="application/pdf")processPdfFile(f);},[processPdfFile]);

  function confirmPdfRequest(){
    if(!pdfResult)return;
    const emp=employees.find(e=>e.name===pdfResult.matchedEmployee)||employees.find(e=>e.name.toLowerCase().includes((pdfResult.employeeName||"").toLowerCase()));
    if(!emp||!pdfResult.from||!pdfResult.to)return;
    const days=pdfResult.days||dbw(pdfResult.from,pdfResult.to);
    setRequests(p=>[{id:nRId,employeeId:emp.id,employeeName:emp.name,bucket:pdfResult.bucket||"vacation",from:pdfResult.from,to:pdfResult.to,days,status:"pending",note:pdfResult.note||"",source:"pdf"},...p]);
    setNRId(n=>n+1);setPdfResult(null);setPdfError("");setModal(null);setTab("requests");setStatusF("pending");
  }

  const [expandedBucket, setExpandedBucket] = useState(null);

  function addBonusDays(empId, days) {
    setEmployees(prev=>prev.map(e=>e.id!==empId?e:{...e, vacation:{...e.vacation, total: +(e.vacation.total + days).toFixed(1)}}));
    setDetailEmp(prev=>prev?{...prev, vacation:{...prev.vacation, total: +(prev.vacation.total + days).toFixed(1)}}:prev);
    setBonusInput("");
  }

  const closeModal=()=>{setModal(null);setImportRows([]);setImportErr("");setPdfResult(null);setPdfError("");setPdfParsing(false);setExpandedBucket(null);setBonusInput("");};
  const bk=key=>BUCKETS.find(b=>b.key===key)||BUCKETS[0];

  return (
    <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      style={{fontFamily:"'Poppins',sans-serif",background:"#f0f8fa",minHeight:"100vh",position:"relative"}}>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>

      {isDragging&&(
        <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,156,189,0.1)",border:"3px dashed #ffd000",pointerEvents:"none",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(2px)"}}>
          <div style={{background:"#fff",borderRadius:20,padding:"28px 44px",textAlign:"center",boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
            <p style={{fontSize:44,margin:"0 0 8px"}}>📄</p>
            <p style={{margin:0,fontFamily:"'Poppins',sans-serif",fontSize:20,color:"#111111"}}>Drop PDF to import request</p>
            <p style={{margin:"5px 0 0",fontSize:12,color:"#aaa"}}>AI will extract employee, dates & leave type</p>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{background:"#009cbd",padding:"0 28px",display:"flex",alignItems:"center",justifyContent:"space-between",height:62,position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <img src="/mnt/user-data/uploads/IlluminateLogo_RGB.jpg" alt="illuminate" style={{height:28,objectFit:"contain",filter:"brightness(0) invert(1)"}}/>
          <span style={{width:1,height:22,background:"rgba(255,255,255,0.2)",margin:"0 8px"}}/>
          <span style={{color:"rgba(255,255,255,0.7)",fontSize:12,fontWeight:500,letterSpacing:"0.04em"}}>PTO Manager</span>
        </div>
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>{setPdfResult(null);setPdfError("");setPdfParsing(false);setModal("pdf");}} style={{padding:"7px 13px",background:"rgba(0,156,189,0.1)",border:"1px solid rgba(0,156,189,0.5)",color:"#ffd000",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>📄 Import PDF</button>
          <button onClick={()=>setModal("policy")} style={{padding:"7px 13px",background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:500}}>📋 Policy</button>
          <button onClick={()=>setModal("import")} style={{padding:"7px 13px",background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:500}}>📥 Bulk Import</button>
          <button onClick={()=>setModal("addEmp")} style={{padding:"7px 13px",background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:500}}>+ Employee</button>
          <button onClick={()=>setModal("request")} style={{padding:"7px 13px",background:"#ffd000",border:"none",color:"#111111",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"inherit"}}>+ New Request</button>
        </div>
      </div>

      <div style={{maxWidth:1320,margin:"0 auto",padding:"22px 20px"}}>

        {/* STATS */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
          {[{l:"Total Employees",v:stats.total,i:"👥",c:"#009cbd"},{l:"Pending Requests",v:stats.pending,i:"⏳",c:"#b08a00"},{l:"On Leave Today",v:stats.onLeave,i:"🏖️",c:"#006d82"},{l:"Approved This Month",v:stats.appMonth,i:"✅",c:"#333333"}].map(c=>(
            <div key={c.l} style={{background:"#fff",borderRadius:14,padding:"16px 20px",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",border:"1px solid #ECEAE5"}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <div>
                  <p style={{margin:0,fontSize:10,color:"#aaa",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em"}}>{c.l}</p>
                  <p style={{margin:"5px 0 0",fontSize:30,fontWeight:700,color:c.c,lineHeight:1,fontFamily:"'Poppins',sans-serif"}}>{c.v}</p>
                </div>
                <span style={{fontSize:20}}>{c.i}</span>
              </div>
            </div>
          ))}
        </div>

        {/* BUCKET SUMMARY */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
          {BUCKETS.map(b=>{
            const tu=employees.reduce((s,e)=>s+usedDays(e.id,b.key,requests),0);
            const ta=employees.reduce((s,e)=>s+e[b.key].total,0);
            const pct=ta?Math.round(tu/ta*100):0;
            return (
              <div key={b.key} style={{background:b.bg,borderRadius:14,padding:"14px 18px",border:`1px solid ${b.light}`}}>
                <p style={{margin:0,fontSize:10,fontWeight:700,color:b.color,textTransform:"uppercase",letterSpacing:"0.05em"}}>{b.label}</p>
                <p style={{margin:"3px 0 7px",fontSize:20,fontWeight:700,color:b.color,fontFamily:"'Poppins',sans-serif"}}>{fmt(tu)}<span style={{fontSize:12,fontWeight:400,opacity:0.6}}>/{fmt(ta)}d</span></p>
                <div style={{height:5,background:"rgba(255,255,255,0.55)",borderRadius:99,overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,height:"100%",background:b.color,borderRadius:99}}/>
                </div>
                <p style={{margin:"4px 0 0",fontSize:11,color:b.color,opacity:0.75}}>{pct}% utilized</p>
              </div>
            );
          })}
        </div>

        {/* TABS */}
        <div style={{display:"flex",gap:4,marginBottom:14,background:"#d8eef3",borderRadius:10,padding:4,width:"fit-content"}}>
          {[["employees","👥 Employees"],["requests",`📋 Requests${stats.pending>0?` (${stats.pending})`:""}`]].map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:"8px 20px",borderRadius:7,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"inherit",background:tab===t?"#009cbd":"transparent",color:tab===t?"#fff":"#555",boxShadow:tab===t?"0 1px 4px rgba(0,0,0,0.1)":"none",transition:"all 0.15s"}}>{l}</button>
          ))}
        </div>

        {/* FILTERS */}
        <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{position:"relative",maxWidth:260}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#ccc",fontSize:13}}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{width:220,padding:"8px 12px 8px 30px",borderRadius:9,border:"1px solid #DDD9D0",background:"#fff",fontSize:13,fontFamily:"inherit",outline:"none"}}/>
          </div>
          {tab==="employees"?(
            <>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {TEAMS.map(d=><button key={d} onClick={()=>setTeamF(d)} style={{padding:"6px 11px",borderRadius:7,border:"1px solid",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit",background:teamF===d?"#009cbd":"#fff",color:teamF===d?"#fff":"#666",borderColor:teamF===d?"#009cbd":"#b8dde5"}}>{d}</button>)}
              </div>
              <span style={{color:"#ddd"}}>|</span>
              {ROLES.map(r=><button key={r} onClick={()=>setRoleF(r)} style={{padding:"6px 11px",borderRadius:7,border:"1px solid",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit",background:roleF===r?"#009cbd":"#fff",color:roleF===r?"#fff":"#666",borderColor:roleF===r?"#009cbd":"#b8dde5"}}>{r}</button>)}
            </>
          ):(
            <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
              {["all","pending","approved","denied"].map(s=><button key={s} onClick={()=>setStatusF(s)} style={{padding:"6px 11px",borderRadius:7,border:"1px solid",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit",textTransform:"capitalize",background:statusF===s?"#009cbd":"#fff",color:statusF===s?"#fff":"#666",borderColor:statusF===s?"#009cbd":"#b8dde5"}}>{s}</button>)}
              <span style={{color:"#ddd"}}>|</span>
              {[{key:"all",label:"All"},...BUCKETS].map(({key,label,color})=><button key={key} onClick={()=>setBucketF(key)} style={{padding:"6px 11px",borderRadius:7,border:"1px solid",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit",background:bucketF===key?(color||"#111111"):"#fff",color:bucketF===key?"#fff":"#666",borderColor:bucketF===key?(color||"#111111"):"#b8dde5"}}>{label}</button>)}
            </div>
          )}
        </div>

        {/* EMPLOYEES TABLE */}
        {tab==="employees"&&(
          <div style={{background:"#fff",borderRadius:16,border:"1px solid #ECEAE5",overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:"#f5fbfc",borderBottom:"1px solid #ECEAE5"}}>
                {["Employee","Team","Accrual Rate","Vacation","Sick Days","Personal Days","Float Holiday"].map(h=>(
                  <th key={h} style={{padding:"11px 14px",textAlign:"left",fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtEmps.map((emp,i)=>(
                  <tr key={emp.id} style={{borderBottom:i<filtEmps.length-1?"1px solid #F2F0EB":"none",cursor:"pointer"}}
                    onClick={()=>{setDetailEmp(emp);setModal("detail");setExpandedBucket(null);}}
                    onMouseEnter={e=>e.currentTarget.style.background="#f5fbfc"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"12px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:34,height:34,borderRadius:"50%",background:avC(emp.name),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:11,flexShrink:0}}>{ini(emp.name)}</div>
                        <div>
                          <p style={{margin:0,fontWeight:600,fontSize:13,color:"#111111"}}>{emp.name}</p>
                          <div style={{display:"flex",gap:4,marginTop:2,flexWrap:"wrap"}}>
                            <span style={{fontSize:10,color:"#aaa"}}>{emp.role}</span>
                            {!vacationAccrualEligible(emp)&&<span style={{fontSize:9,fontWeight:700,background:"#FFF8E7",color:"#B76E00",padding:"1px 5px",borderRadius:4}}>Vac accrual starts {new Date(new Date(emp.startDate).setMonth(new Date(emp.startDate).getMonth()+6)).toLocaleDateString("en-US",{month:"short",year:"numeric"})}</span>}
                            {!otherBucketsEligible(emp)&&<span style={{fontSize:9,fontWeight:700,background:"#F3E8F7",color:"#009cbd",padding:"1px 5px",borderRadius:4}}>Eligible {new Date(new Date(emp.startDate).getTime()+90*86400000).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{padding:"12px 14px"}}>
                      <span style={{padding:"3px 8px",borderRadius:5,background:"#e4f4f8",fontSize:11,fontWeight:500,color:"#555"}}>{emp.department}</span>
                    </td>
                    <td style={{padding:"12px 14px"}}>
                      <span style={{fontSize:12,fontWeight:600,color:emp.accrualRate>=5?"#009cbd":"#006d82"}}>{emp.accrualRate} hrs/period</span>
                    </td>
                    {BUCKETS.map(b=>{
                      const used=usedDays(emp.id,b.key,requests);
                      const total=emp[b.key].total;
                      const rem=+(total-used).toFixed(1),pct=total?Math.min(used/total,1):0;
                      const isNeg=rem<0;
                      const paused=b.key==="vacation"&&accrualPaused(emp.id,emp,requests);
                      const ineligible=b.key==="vacation"?!vacationAccrualEligible(emp):!otherBucketsEligible(emp);
                      return (
                        <td key={b.key} style={{padding:"12px 14px"}}>
                          <div style={{minWidth:110}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,alignItems:"center"}}>
                              <span style={{fontSize:11,fontWeight:600,color:ineligible?"#bbb":b.color}}>{fmt(used)}/{fmt(total)}d</span>
                              <span style={{fontSize:11,fontWeight:700,color:isNeg?"#C0392B":rem===0?"#E74C3C":rem<=1?"#ffd000":"#009cbd"}}>{isNeg?"⚠ ":""}{fmt(rem)}</span>
                            </div>
                            <div style={{height:5,background:ineligible?"#d8eef3":b.light,borderRadius:99,overflow:"hidden"}}>
                              <div style={{width:`${Math.min(Math.abs(pct)*100,100)}%`,height:"100%",background:ineligible?"#ccc":isNeg?"#E74C3C":b.color,borderRadius:99}}/>
                            </div>
                            {paused&&<span style={{fontSize:9,fontWeight:700,color:"#B76E00",display:"block",marginTop:3}}>⏸ Accrual paused</span>}
                            {ineligible&&<span style={{fontSize:9,color:"#bbb",display:"block",marginTop:3}}>Not yet eligible</span>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {filtEmps.length===0&&<div style={{padding:40,textAlign:"center",color:"#ccc"}}>No employees found</div>}
            <div style={{padding:"10px 16px",background:"#f5fbfc",borderTop:"1px solid #F0EDE8",fontSize:11,color:"#aaa"}}>
              {filtEmps.length} employee{filtEmps.length!==1?"s":""} · Click any row to see full PTO breakdown
            </div>
          </div>
        )}

        {/* REQUESTS */}
        {tab==="requests"&&(
          <div style={{display:"flex",flexDirection:"column",gap:9}}>
            {filtReqs.map(req=>{
              const sc=STATUS_META[req.status],b=bk(req.bucket);
              return (
                <div key={req.id} style={{background:"#fff",borderRadius:13,border:"1px solid #ECEAE5",padding:"14px 20px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)",transition:"box-shadow 0.15s,transform 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.09)";e.currentTarget.style.transform="translateY(-1px)"}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04)";e.currentTarget.style.transform="none"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:36,height:36,borderRadius:"50%",background:avC(req.employeeName),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:12}}>{ini(req.employeeName)}</div>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                          <p style={{margin:0,fontWeight:600,fontSize:14,color:"#111111"}}>{req.employeeName}</p>
                          {req.source==="pdf"&&<span style={{padding:"2px 6px",background:"#FFF8E7",borderRadius:4,fontSize:10,fontWeight:700,color:"#B76E00"}}>📄 PDF</span>}
                        </div>
                        <p style={{margin:"2px 0 0",fontSize:11,color:"#aaa"}}>{req.days} day{req.days!==1?"s":""} · {req.from!==req.to?`${fd(req.from)} – ${fd(req.to)}`:fd(req.from)}</p>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{padding:"3px 10px",borderRadius:6,background:b.bg,fontSize:11,fontWeight:700,color:b.color}}>{b.label}</span>
                      {req.note&&<span style={{fontSize:12,color:"#aaa",fontStyle:"italic"}}>"{req.note}"</span>}
                      <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:7,background:sc.bg}}>
                        <div style={{width:6,height:6,borderRadius:"50%",background:sc.dot}}/>
                        <span style={{fontSize:11,fontWeight:600,color:sc.text,textTransform:"capitalize"}}>{req.status}</span>
                      </div>
                      {req.status==="pending"&&(
                        <div style={{display:"flex",gap:5}}>
                          <button onClick={()=>handleAction(req.id,"approve")} style={{padding:"5px 12px",background:"#E8F5EE",border:"none",color:"#006d82",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>Approve</button>
                          <button onClick={()=>handleAction(req.id,"deny")} style={{padding:"5px 12px",background:"#FEECEC",border:"none",color:"#C0392B",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>Deny</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {filtReqs.length===0&&<div style={{padding:60,textAlign:"center",background:"#fff",borderRadius:16,border:"1px solid #ECEAE5"}}><p style={{fontSize:36,margin:"0 0 10px"}}>📭</p><p style={{margin:0,color:"#ccc",fontWeight:600}}>No requests found</p></div>}
          </div>
        )}
      </div>

      {/* MODALS */}
      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(5px)",padding:20}}>

          {/* POLICY REFERENCE */}
          {modal==="policy"&&(
            <div style={{background:"#fff",borderRadius:20,padding:28,width:520,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
                <h2 style={{margin:0,fontFamily:"'Poppins',sans-serif",fontSize:20}}>📋 Illuminate PTO Policy</h2>
                <button onClick={closeModal} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#aaa"}}>✕</button>
              </div>
              {[
                { title:"Vacation Accrual", color:"#009cbd", bg:"#E8F5EE", light:"#C8E6D5", items:[
                  "Accrues at your personal rate per pay period (semi-monthly: 15th & last day of month, 24 periods/year)",
                  "Accrual begins 6 months after hire date",
                  "Accrual pauses once balance reaches 15 days — resumes when days are used",
                  "Vacation can go negative (borrowing against future accrual)",
                  "Cannot be cashed out",
                  "Bonus days may be awarded above the cap by management",
                ]},
                { title:"Vacation Rollover", color:"#006d82", bg:"#E3EEF7", light:"#B8D4EA", items:[
                  "Up to 5 vacation days may roll over to the following year",
                  "Rolled-over days expire March 31 — use it or lose it",
                  "Unused rollover days after March 31 are forfeited (no cash out)",
                ]},
                { title:"Sick Days", color:"#006d82", bg:"#E3EEF7", light:"#B8D4EA", items:[
                  "5 sick days granted per year, reset to 0 on January 1",
                  "Eligible to use after 90 days of employment",
                  "Do not roll over — unused days are forfeited at year end",
                  "Cannot go negative",
                ]},
                { title:"Personal Days", color:"#009cbd", bg:"#F3E8F7", light:"#DDB8EB", items:[
                  "2 personal days granted per year, reset to 0 on January 1",
                  "Eligible to use after 90 days of employment",
                  "Do not roll over — unused days are forfeited at year end",
                  "Cannot go negative",
                ]},
                { title:"Floating Holiday", color:"#b08a00", bg:"#FAEEE8", light:"#F0C4AE", items:[
                  "1 floating holiday granted per year",
                  "Employee chooses when to use it",
                  "Must be used by December 31 or it is forfeited",
                  "Does not roll over, cannot go negative",
                  "Eligible to use after 90 days of employment",
                ]},
                { title:"Day Counting", color:"#333333", bg:"#f0f8fa", light:"#d8eef3", items:[
                  "All PTO requests count business days only (Monday–Friday)",
                  "Weekends within a request window are not counted",
                  "Applies to all buckets",
                ]},
              ].map(section=>(
                <div key={section.title} style={{marginBottom:16,borderRadius:12,border:`1px solid ${section.light}`,overflow:"hidden"}}>
                  <div style={{padding:"10px 14px",background:section.bg}}>
                    <p style={{margin:0,fontWeight:700,fontSize:13,color:section.color}}>{section.title}</p>
                  </div>
                  <div style={{padding:"10px 14px",background:"#fff"}}>
                    {section.items.map((item,i)=>(
                      <div key={i} style={{display:"flex",gap:8,marginBottom:i<section.items.length-1?6:0}}>
                        <span style={{color:section.color,fontWeight:700,flexShrink:0,marginTop:1}}>·</span>
                        <span style={{fontSize:12,color:"#444",lineHeight:1.5}}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* EMPLOYEE DETAIL */}
          {modal==="detail"&&detailEmp&&(
            <div style={{background:"#fff",borderRadius:20,padding:28,width:500,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:44,height:44,borderRadius:"50%",background:avC(detailEmp.name),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:15}}>{ini(detailEmp.name)}</div>
                  <div>
                    <h2 style={{margin:0,fontFamily:"'Poppins',sans-serif",fontSize:19}}>{detailEmp.name}</h2>
                    <p style={{margin:0,fontSize:12,color:"#888"}}>{detailEmp.role} · {detailEmp.department}</p>
                  </div>
                </div>
                <button onClick={closeModal} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#aaa"}}>✕</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9,marginBottom:14}}>
                {[["Hire Date",detailEmp.startDate||"—"],["Accrual Rate",(detailEmp.accrualRate||3.33)+" hrs/period"],["Role",detailEmp.role||"—"]].map(([k,v])=>(
                  <div key={k} style={{padding:"10px 12px",background:"#f5fbfc",borderRadius:9,border:"1px solid #F0EDE8"}}>
                    <p style={{margin:0,fontSize:10,fontWeight:600,color:"#bbb",textTransform:"uppercase"}}>{k}</p>
                    <p style={{margin:"2px 0 0",fontSize:13,fontWeight:600,color:"#333"}}>{v}</p>
                  </div>
                ))}
              </div>
              {/* Eligibility status */}
              {(!vacationAccrualEligible(detailEmp)||!otherBucketsEligible(detailEmp))&&(
                <div style={{padding:"10px 13px",background:"#FFF8E7",borderRadius:9,border:"1px solid #FDECC8",marginBottom:14}}>
                  {!vacationAccrualEligible(detailEmp)&&<p style={{margin:0,fontSize:12,color:"#B76E00"}}>⏳ <b>Vacation accrual</b> starts {new Date(new Date(detailEmp.startDate).setMonth(new Date(detailEmp.startDate).getMonth()+6)).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p>}
                  {!otherBucketsEligible(detailEmp)&&<p style={{margin:!vacationAccrualEligible(detailEmp)?"4px 0 0":0,fontSize:12,color:"#B76E00"}}>⏳ <b>Sick / Personal / Float</b> eligible to use after {new Date(new Date(detailEmp.startDate).getTime()+90*86400000).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</p>}
                </div>
              )}
              {/* Bonus vacation days */}
              <div style={{padding:"12px 14px",background:"#f5fbfc",borderRadius:10,border:"1px solid #ECEAE5",marginBottom:14}}>
                <p style={{margin:"0 0 8px",fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em"}}>🎁 Award Bonus Vacation Days</p>
                <div style={{display:"flex",gap:8}}>
                  <input type="number" min="0.5" step="0.5" placeholder="# of days" value={bonusInput} onChange={e=>setBonusInput(e.target.value)} style={{...IS,flex:1}}/>
                  <button onClick={()=>bonusInput&&+bonusInput>0&&addBonusDays(detailEmp.id,+bonusInput)} style={{padding:"9px 16px",background:"#009cbd",border:"none",color:"#fff",borderRadius:9,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit",whiteSpace:"nowrap"}}>Add Days</button>
                </div>
                <p style={{margin:"6px 0 0",fontSize:11,color:"#aaa"}}>Adds to their vacation total above the standard accrual cap.</p>
              </div>
              {BUCKETS.map(b=>{
                const used=usedDays(detailEmp.id,b.key,requests);
                const total=detailEmp[b.key].total;
                const rem=+(total-used).toFixed(1),pct=total?Math.min(Math.abs(used/total),1):0;
                const isNeg=rem<0;
                const isOpen=expandedBucket===b.key;
                const paused=b.key==="vacation"&&!isNeg&&(total-used)>=POLICY.vacationAccrualCapDays;
                const ineligible=b.key==="vacation"?!vacationAccrualEligible(detailEmp):!otherBucketsEligible(detailEmp);
                const usedReqs=requests.filter(r=>r.employeeId===detailEmp.id&&r.bucket===b.key&&r.status==="approved").sort((a,c)=>new Date(a.from)-new Date(c.from));
                return (
                  <div key={b.key} style={{borderRadius:11,border:`1px solid ${isOpen?b.color:isNeg?"#E74C3C":b.light}`,marginBottom:9,overflow:"hidden",boxShadow:isOpen?`0 4px 16px ${b.color}22`:"none"}}>
                    <div onClick={()=>setExpandedBucket(isOpen?null:b.key)} style={{padding:"13px 15px",background:isNeg?"#FEECEC":b.bg,cursor:"pointer",userSelect:"none"}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:7,alignItems:"center"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontWeight:700,fontSize:13,color:isNeg?"#C0392B":b.color}}>{b.label}</span>
                          {paused&&<span style={{fontSize:9,fontWeight:700,background:"#FFF8E7",color:"#B76E00",padding:"2px 6px",borderRadius:4}}>⏸ Accrual paused</span>}
                          {ineligible&&<span style={{fontSize:9,fontWeight:700,background:"#F3E8F7",color:"#009cbd",padding:"2px 6px",borderRadius:4}}>Not yet eligible</span>}
                          {isNeg&&<span style={{fontSize:9,fontWeight:700,background:"#FEECEC",color:"#C0392B",padding:"2px 6px",borderRadius:4}}>⚠ Negative balance</span>}
                          {b.key==="floatHoliday"&&<span style={{fontSize:9,color:b.color,opacity:0.7}}>Use by Dec 31</span>}
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:12,color:isNeg?"#C0392B":b.color,fontWeight:700}}>{isNeg?"−":""}{fmt(Math.abs(rem))} days {isNeg?"owed":"left"}</span>
                          <span style={{fontSize:12,color:b.color,opacity:0.5,transform:isOpen?"rotate(180deg)":"none",display:"inline-block"}}>▾</span>
                        </div>
                      </div>
                      <div style={{height:7,background:"rgba(255,255,255,0.6)",borderRadius:99,overflow:"hidden",marginBottom:6}}>
                        <div style={{width:`${Math.min(pct*100,100)}%`,height:"100%",background:isNeg?"#E74C3C":b.color,borderRadius:99}}/>
                      </div>
                      <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                        <span style={{fontSize:11,color:isNeg?"#C0392B":b.color}}>Used: <b>{fmt(used)}d</b></span>
                        <span style={{fontSize:11,color:isNeg?"#C0392B":b.color}}>Allotted: <b>{fmt(total)}d</b></span>
                        {usedReqs.length>0&&<span style={{fontSize:11,color:b.color,opacity:0.7}}>{usedReqs.length} request{usedReqs.length!==1?"s":""} · click to expand</span>}
                      </div>
                    </div>
                    {isOpen&&(
                      <div style={{background:"#fff",borderTop:`1px solid ${isNeg?"#F5C6C6":b.light}`,padding:"10px 15px"}}>
                        {usedReqs.length===0?(
                          <p style={{margin:0,fontSize:12,color:"#bbb",textAlign:"center",padding:"8px 0"}}>No approved {b.label.toLowerCase()} on record</p>
                        ):(
                          <div>
                            <p style={{margin:"0 0 8px",fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.06em"}}>Approved dates</p>
                            {usedReqs.map(r=>(
                              <div key={r.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 10px",borderRadius:8,background:b.bg,marginBottom:5,border:`1px solid ${b.light}`}}>
                                <div style={{display:"flex",alignItems:"center",gap:8}}>
                                  <div style={{width:6,height:6,borderRadius:"50%",background:b.color,flexShrink:0}}/>
                                  <span style={{fontSize:13,fontWeight:500,color:"#333"}}>{r.from===r.to?fd(r.from):`${fd(r.from)} – ${fd(r.to)}`}</span>
                                  {r.source==="pdf"&&<span style={{fontSize:10,fontWeight:700,color:"#B76E00",background:"#FFF8E7",padding:"1px 5px",borderRadius:4}}>PDF</span>}
                                </div>
                                <span style={{fontSize:12,fontWeight:600,color:b.color}}>{fmt(r.days)} day{r.days!==1?"s":""}</span>
                              </div>
                            ))}
                            <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${b.light}`,display:"flex",justifyContent:"space-between"}}>
                              <span style={{fontSize:11,color:"#aaa"}}>Total used</span>
                              <span style={{fontSize:12,fontWeight:700,color:b.color}}>{fmt(usedReqs.reduce((s,r)=>s+r.days,0))} days</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* PDF IMPORT */}
          {modal==="pdf"&&(
            <div style={{background:"#fff",borderRadius:22,padding:28,width:500,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(0,0,0,0.25)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <h2 style={{margin:0,fontFamily:"'Poppins',sans-serif",fontSize:20}}>📄 Import PTO from PDF</h2>
                <button onClick={closeModal} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#aaa"}}>✕</button>
              </div>
              {!pdfResult&&!pdfParsing&&(
                <div onClick={()=>pdfDropRef.current.click()} style={{border:"2px dashed #DDD9D0",borderRadius:14,padding:"34px 20px",textAlign:"center",cursor:"pointer",transition:"all 0.2s",background:"#f5fbfc",marginBottom:pdfError?12:0}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#ffd000";e.currentTarget.style.background="#FFFDF7"}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#b8dde5";e.currentTarget.style.background="#f5fbfc"}}>
                  <p style={{fontSize:42,margin:"0 0 10px"}}>📋</p>
                  <p style={{margin:0,fontWeight:600,color:"#333",fontSize:14}}>Drop a PTO request PDF here</p>
                  <p style={{margin:"5px 0 0",fontSize:12,color:"#aaa"}}>or click to browse</p>
                  <input ref={pdfDropRef} type="file" accept="application/pdf" onChange={handlePdfInputChange} style={{display:"none"}}/>
                </div>
              )}
              {pdfParsing&&(
                <div style={{padding:"44px 20px",textAlign:"center"}}>
                  <div style={{width:44,height:44,border:"4px solid #F2F0EB",borderTop:"4px solid #ffd000",borderRadius:"50%",margin:"0 auto 14px",animation:"spin 0.8s linear infinite"}}/>
                  <p style={{margin:0,fontWeight:600,color:"#444"}}>Reading PDF with AI…</p>
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              )}
              {pdfError&&<div style={{padding:"10px 13px",background:"#FEECEC",borderRadius:9,color:"#C0392B",fontSize:13,marginTop:12}}>⚠️ {pdfError}</div>}
              {pdfResult&&!pdfParsing&&(()=>{
                const emp=employees.find(e=>e.name===pdfResult.matchedEmployee)||employees.find(e=>e.name.toLowerCase().includes((pdfResult.employeeName||"").toLowerCase()));
                const b=bk(pdfResult.bucket);
                const days=pdfResult.days||(pdfResult.from&&pdfResult.to?dbw(pdfResult.from,pdfResult.to):0);
                const confColor=pdfResult.confidence==="high"?"#009cbd":pdfResult.confidence==="medium"?"#B76E00":"#C0392B";
                const confBg=pdfResult.confidence==="high"?"#E8F5EE":pdfResult.confidence==="medium"?"#FFF8E7":"#FEECEC";
                return (
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
                      <div style={{flex:1,height:1,background:"#dff2f6"}}/>
                      <span style={{padding:"3px 12px",borderRadius:20,background:confBg,fontSize:11,fontWeight:700,color:confColor}}>{pdfResult.confidence==="high"?"✓ High confidence":"⚠ "+pdfResult.confidence+" confidence"}</span>
                      <div style={{flex:1,height:1,background:"#dff2f6"}}/>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:12}}>
                      <div style={{gridColumn:"1/-1",padding:"13px 15px",background:"#f5fbfc",borderRadius:11,border:emp?"1px solid #E8F5EE":"1px solid #FEECEC"}}>
                        <p style={{margin:0,fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase"}}>Employee</p>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
                          <div style={{display:"flex",alignItems:"center",gap:9}}>
                            {emp&&<div style={{width:30,height:30,borderRadius:"50%",background:avC(emp.name),display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:11}}>{ini(emp.name)}</div>}
                            <div>
                              <p style={{margin:0,fontWeight:700,fontSize:14,color:"#111111"}}>{pdfResult.employeeName||"Unknown"}</p>
                              {emp&&<p style={{margin:0,fontSize:11,color:"#888"}}>{emp.role} · {emp.department}</p>}
                            </div>
                          </div>
                          {emp?<span style={{padding:"3px 8px",background:"#E8F5EE",borderRadius:5,fontSize:11,fontWeight:600,color:"#009cbd"}}>✓ Matched</span>
                             :<span style={{padding:"3px 8px",background:"#FEECEC",borderRadius:5,fontSize:11,fontWeight:600,color:"#C0392B"}}>⚠ Not found</span>}
                        </div>
                      </div>
                      <div style={{padding:"12px 14px",background:b.bg,borderRadius:11,border:`1px solid ${b.light}`}}>
                        <p style={{margin:0,fontSize:10,fontWeight:700,color:b.color,textTransform:"uppercase"}}>Leave Type</p>
                        <p style={{margin:"5px 0 0",fontWeight:700,fontSize:15,color:b.color}}>{b.label}</p>
                      </div>
                      <div style={{padding:"12px 14px",background:"#f0f8fa",borderRadius:11,border:"1px solid #ECEAE5"}}>
                        <p style={{margin:0,fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase"}}>Duration</p>
                        <p style={{margin:"5px 0 0",fontWeight:700,fontSize:15,color:"#111111"}}>{days} day{days!==1?"s":""}</p>
                      </div>
                      <div style={{gridColumn:"1/-1",padding:"12px 14px",background:"#f0f8fa",borderRadius:11,border:"1px solid #ECEAE5"}}>
                        <p style={{margin:0,fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase"}}>Date Range</p>
                        <p style={{margin:"5px 0 0",fontWeight:600,fontSize:14,color:"#111111"}}>{pdfResult.from?fd(pdfResult.from):"?"}{pdfResult.from!==pdfResult.to?` → ${pdfResult.to?fd(pdfResult.to):"?"}`:""}</p>
                      </div>
                      {pdfResult.note&&<div style={{gridColumn:"1/-1",padding:"12px 14px",background:"#f0f8fa",borderRadius:11,border:"1px solid #ECEAE5"}}><p style={{margin:0,fontSize:10,fontWeight:700,color:"#aaa",textTransform:"uppercase"}}>Note</p><p style={{margin:"4px 0 0",fontSize:13,color:"#555",fontStyle:"italic"}}>"{pdfResult.note}"</p></div>}
                    </div>
                    {pdfResult.warnings?.length>0&&<div style={{padding:"9px 12px",background:"#FFF8E7",borderRadius:9,marginBottom:12,border:"1px solid #FDECC8"}}>{pdfResult.warnings.map((w,i)=><p key={i} style={{margin:i>0?"3px 0 0":0,fontSize:12,color:"#B76E00"}}>⚠ {w}</p>)}</div>}
                    <div style={{display:"flex",gap:9}}>
                      <button onClick={()=>{setPdfResult(null);setPdfError("");}} style={{flex:1,padding:"10px",background:"#e5f5fa",border:"none",borderRadius:9,color:"#006d82",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>← Try Another</button>
                      <button onClick={confirmPdfRequest} disabled={!emp||!pdfResult.from||!pdfResult.to}
                        style={{flex:2,padding:"10px",background:emp&&pdfResult.from&&pdfResult.to?"linear-gradient(135deg,#009cbd,#007a9a)":"#b8dde5",border:"none",borderRadius:9,color:"#fff",fontWeight:700,fontSize:13,cursor:emp?"pointer":"not-allowed",fontFamily:"inherit"}}>
                        ✓ Add to Dashboard
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* NEW REQUEST */}
          {modal==="request"&&(
            <div style={{background:"#fff",borderRadius:20,padding:28,width:400,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <h2 style={{margin:0,fontFamily:"'Poppins',sans-serif",fontSize:20}}>New PTO Request</h2>
                <button onClick={closeModal} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#aaa"}}>✕</button>
              </div>
              {[
                {l:"Employee",el:<select value={nReq.employeeId} onChange={e=>setNReq(p=>({...p,employeeId:e.target.value}))} style={IS}><option value="">Select…</option>{employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>},
                {l:"Leave Type",el:<select value={nReq.bucket} onChange={e=>setNReq(p=>({...p,bucket:e.target.value}))} style={IS}>{BUCKETS.map(b=><option key={b.key} value={b.key}>{b.label}</option>)}</select>},
                {l:"From",el:<input type="date" value={nReq.from} onChange={e=>setNReq(p=>({...p,from:e.target.value}))} style={IS}/>},
                {l:"To",  el:<input type="date" value={nReq.to}   onChange={e=>setNReq(p=>({...p,to:e.target.value}))}   style={IS}/>},
                {l:"Note",el:<input type="text" placeholder="Optional note…" value={nReq.note} onChange={e=>setNReq(p=>({...p,note:e.target.value}))} style={IS}/>},
              ].map(({l,el})=><div key={l} style={{marginBottom:13}}><label style={LS}>{l}</label>{el}</div>)}
              {nReq.from&&nReq.to&&nReq.from<=nReq.to&&<div style={{padding:"9px 13px",background:"#e4f4f8",borderRadius:9,marginBottom:13,fontSize:13,color:"#555"}}>📅 {dbw(nReq.from,nReq.to)} day(s) requested</div>}
              <button onClick={submitReq} style={{width:"100%",padding:"11px",background:"#009cbd",border:"none",borderRadius:10,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Submit Request</button>
            </div>
          )}

          {/* ADD EMPLOYEE */}
          {modal==="addEmp"&&(
            <div style={{background:"#fff",borderRadius:20,padding:28,width:520,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <h2 style={{margin:0,fontFamily:"'Poppins',sans-serif",fontSize:20}}>Add Employee</h2>
                <button onClick={closeModal} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#aaa"}}>✕</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
                {[
                  {l:"Full Name",     el:<input type="text" placeholder="Jane Smith"  value={nEmp.name} onChange={e=>setNEmp(p=>({...p,name:e.target.value}))} style={IS}/>},
                  {l:"Role",         el:<select value={nEmp.role} onChange={e=>setNEmp(p=>({...p,role:e.target.value}))} style={IS}><option>Employee</option><option>Manager</option></select>},
                  {l:"Team",         el:<select value={nEmp.department} onChange={e=>setNEmp(p=>({...p,department:e.target.value}))} style={IS}>{TEAMS.filter(d=>d!=="All").map(d=><option key={d}>{d}</option>)}</select>},
                  {l:"Start Date",   el:<input type="date" value={nEmp.startDate} onChange={e=>setNEmp(p=>({...p,startDate:e.target.value}))} style={IS}/>},
                  {l:"Accrual Rate (days/mo)", el:<input type="number" step="0.01" value={nEmp.accrualRate} onChange={e=>setNEmp(p=>({...p,accrualRate:+e.target.value}))} style={IS}/>},
                ].map(({l,el})=><div key={l}><label style={LS}>{l}</label>{el}</div>)}
              </div>
              <p style={{margin:"0 0 10px",fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:"0.06em"}}>Annual PTO Totals</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:20}}>
                {BUCKETS.map(b=>(
                  <div key={b.key} style={{padding:"11px 13px",background:b.bg,borderRadius:10,border:`1px solid ${b.light}`}}>
                    <label style={{...LS,color:b.color}}>{b.label}</label>
                    <input type="number" min="0" step="0.5" value={nEmp[b.key].total} onChange={e=>setNEmp(p=>({...p,[b.key]:{total:e.target.value}}))} style={{...IS,background:"rgba(255,255,255,0.7)",border:`1px solid ${b.light}`}}/>
                  </div>
                ))}
              </div>
              <button onClick={submitEmp} style={{width:"100%",padding:"11px",background:"#009cbd",border:"none",borderRadius:10,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>Add Employee</button>
            </div>
          )}

          {/* BULK IMPORT */}
          {modal==="import"&&(
            <div style={{background:"#fff",borderRadius:20,padding:28,width:560,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <h2 style={{margin:0,fontFamily:"'Poppins',sans-serif",fontSize:20}}>Bulk Import via Excel</h2>
                <button onClick={closeModal} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#aaa"}}>✕</button>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>
                {["Name","Role","Department","Start Date","Accrual Rate","Vacation Total","Vacation Used","Sick Total","Sick Used","Personal Total","Personal Used","Float Holiday Total","Float Holiday Used"].map(c=>(
                  <span key={c} style={{padding:"3px 8px",background:"#e4f4f8",borderRadius:5,fontSize:11,fontWeight:500,color:"#555"}}>{c}</span>
                ))}
              </div>
              <div onClick={()=>fileRef.current.click()} style={{border:"2px dashed #DDD9D0",borderRadius:12,padding:"24px 20px",textAlign:"center",cursor:"pointer",transition:"all 0.2s",marginBottom:12,background:"#f5fbfc"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="#ffd000";e.currentTarget.style.background="#FFFDF7"}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="#b8dde5";e.currentTarget.style.background="#f5fbfc"}}>
                <p style={{fontSize:28,margin:"0 0 7px"}}>📊</p>
                <p style={{margin:0,fontWeight:600,color:"#444",fontSize:14}}>Click to upload Excel file</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleXlsxFile} style={{display:"none"}}/>
              </div>
              {importErr&&<div style={{padding:"9px 13px",background:"#FEECEC",borderRadius:8,color:"#C0392B",fontSize:12,marginBottom:12}}>⚠️ {importErr}</div>}
              {importRows.length>0&&(
                <>
                  <p style={{margin:"0 0 8px",fontSize:12,fontWeight:600,color:"#555"}}>{importRows.length} employee{importRows.length!==1?"s":""} ready:</p>
                  <div style={{maxHeight:180,overflowY:"auto",border:"1px solid #ECEAE5",borderRadius:9,background:"#f5fbfc",marginBottom:13}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr style={{background:"#e4f4f8",position:"sticky",top:0}}>
                        {["Name","Role","Team","Vac","Sick","Pers","Float"].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase"}}>{h}</th>)}
                      </tr></thead>
                      <tbody>{importRows.map((r,i)=>(
                        <tr key={i} style={{borderTop:"1px solid #F0EDE8"}}>
                          <td style={{padding:"6px 10px",fontWeight:500}}>{r.name}</td>
                          <td style={{padding:"6px 10px",color:"#666"}}>{r.role}</td>
                          <td style={{padding:"6px 10px",color:"#666"}}>{r.department}</td>
                          {BUCKETS.map(b=><td key={b.key} style={{padding:"6px 10px",color:b.color,fontWeight:600}}>{r[b.key].used}/{r[b.key].total}d</td>)}
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <button onClick={confirmImport} style={{width:"100%",padding:"11px",background:"#009cbd",border:"none",borderRadius:10,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>✓ Import {importRows.length} Employee{importRows.length!==1?"s":""}</button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
