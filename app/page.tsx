"use client";

import { useEffect, useState } from "react";
import { BusinessLocationSettings, EnrollmentWorkspace } from "./enrollment-workspace";
import { BusinessChildDirectory, PortalSection } from "./portal-sections";
import { SchedulingWorkspace } from "./scheduling-workspace";
import { AdminIntakeWorkspace } from "./admin-intake-workspace";
import { ProgramGroupManager } from "./program-group-manager";
import { Activity, AlertTriangle, ArrowRight, Baby, Bell, BookOpen, Building2, CalendarDays, Check, CheckCircle2, ChevronDown, CircleDollarSign, ClipboardCheck, Download, FileHeart, FileText, HeartPulse, LayoutDashboard, Link2, LockKeyhole, Menu, MessageCircleQuestion, MoreHorizontal, Plus, Printer, Search, Settings, ShieldCheck, Sparkles, Users, Utensils, UserRound, WalletCards, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster, toast } from "sonner";

type Role = "business" | "guardian" | "staff" | "owner";
const roleMeta = {
  business: { label: "Child Care Admin", org: "Little Sprouts Early Learning", initials: "CM" },
  guardian: { label: "Guardian", org: "The Chen family", initials: "MC" },
  staff: { label: "Teaching Staff", org: "Preschool Room A", initials: "JA" },
  owner: { label: "Application Owner", org: "ChildCareRegistration.Com", initials: "SU" },
};
const children = [
  { name: "Mia Chen", age: "3y 8m", program: "Preschool A", status: "Active", risk: "Peanut allergy", completion: 100, initials: "MC", color: "bg-[#d9f2ec] text-[#176354]" },
  { name: "Noah Williams", age: "18m", program: "Toddler 2", status: "Review", risk: "Medication update", completion: 92, initials: "NW", color: "bg-[#fff0cc] text-[#885d06]" },
  { name: "Amelia Brown", age: "10m", program: "Infant 1", status: "Pending", risk: "No alerts", completion: 74, initials: "AB", color: "bg-[#e5e8ff] text-[#3e4c94]" },
  { name: "Leo Martin", age: "4y 3m", program: "Preschool B", status: "Active", risk: "Asthma plan", completion: 100, initials: "LM", color: "bg-[#ffe1e6] text-[#9e3348]" },
];
const capacityRows = [
  { group: "Infant", months: "0–17 months", groups: [
    {name:"Infant 1",capacity:10,days:8,mornings:1,afternoons:1,before:null,after:null},
    {name:"Infant 2",capacity:10,days:5,mornings:2,afternoons:2,before:null,after:null},
    {name:"Infant 3",capacity:10,days:2,mornings:3,afternoons:6,before:null,after:null},
  ]},
  { group: "Toddler", months: "18–29 months", groups: [{name:"Toddler 1",capacity:15,days:10,mornings:3,afternoons:2,before:null,after:null}] },
  { group: "Preschool", months: "30–43 months", groups: [{name:"Preschool 1",capacity:20,days:17,mornings:2,afternoons:1,before:null,after:null}] },
  { group: "Kindergarten", months: "44–67 months", groups: [{name:"Kindergarten 1",capacity:20,days:7,mornings:2,afternoons:3,before:7,after:8}] },
  { group: "School Age", months: "68–156 months", groups: [{name:"School Age 1",capacity:20,days:4,mornings:2,afternoons:3,before:9,after:10}] },
];
const reservationPeriods = ["Full Days","Mornings / AM","Afternoons / PM","Before School","After School"];
const compactReservationLabels = ["Full Day","AM","PM","Before","After"];
const navByRole: Record<Role, {label:string; icon:any}[]> = {
  business: [{label:"Overview",icon:LayoutDashboard},{label:"Registrations",icon:ClipboardCheck},{label:"Children & guardians",icon:Users},{label:"Programs & transitions",icon:CalendarDays},{label:"Scheduling",icon:CalendarDays},{label:"Emergency cards",icon:FileHeart},{label:"Staff access",icon:ShieldCheck},{label:"Registration Form Setup",icon:Link2},{label:"Centre settings",icon:Settings},{label:"Reports",icon:FileText}],
  guardian: [{label:"My family",icon:LayoutDashboard},{label:"Child profiles",icon:Baby},{label:"Documents",icon:FileText},{label:"Emergency contacts",icon:HeartPulse},{label:"Messages",icon:MessageCircleQuestion}],
  staff: [{label:"Room overview",icon:LayoutDashboard},{label:"Child directory",icon:Users},{label:"Dietary & allergies",icon:Utensils},{label:"Medical needs",icon:HeartPulse},{label:"Emergency cards",icon:FileHeart}],
  owner: [{label:"Platform overview",icon:LayoutDashboard},{label:"Organizations",icon:Building2},{label:"Enrollment form",icon:FileText},{label:"Subscriptions",icon:CircleDollarSign},{label:"Support",icon:MessageCircleQuestion},{label:"Data connections",icon:Link2},{label:"Audit & security",icon:ShieldCheck}],
};

function Metric({ icon: Icon, label, value, detail, tone="teal" }: any) {
  const tones:Record<string,string>={teal:"bg-[#dff4ef] text-[#116b5b]",amber:"bg-[#fff1d3] text-[#99640a]",blue:"bg-[#e7edff] text-[#4357a5]",rose:"bg-[#ffe5e8] text-[#aa3549]"};
  return <div className="metric-card"><div className={`metric-icon ${tones[tone]}`}><Icon size={20}/></div><div><p>{label}</p><strong>{value}</strong><span>{detail}</span></div></div>;
}
function utilizationTone(percent:number,redMax=69,yellowMax=89){return percent<=redMax?"low":percent<=yellowMax?"medium":"high"}
function CapacityOverview({onAddGroup}:{onAddGroup:()=>void}){
  const [redMax,setRedMax]=useState(69);
  const [yellowMax,setYellowMax]=useState(89);
  const [draftRed,setDraftRed]=useState(69);
  const [draftYellow,setDraftYellow]=useState(89);
  const [rangeOpen,setRangeOpen]=useState(false);
  const [selectedProgram,setSelectedProgram]=useState<string|null>(null);
  useEffect(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem("ccr-utilization-ranges")||"null");
      if(Number.isInteger(saved?.redMax)&&Number.isInteger(saved?.yellowMax)&&saved.redMax>=0&&saved.redMax<saved.yellowMax&&saved.yellowMax<100){setRedMax(saved.redMax);setYellowMax(saved.yellowMax)}
    }catch{}
  },[]);
  const openRangeSettings=()=>{setDraftRed(redMax);setDraftYellow(yellowMax);setRangeOpen(true)};
  const saveRanges=()=>{
    if(!Number.isInteger(draftRed)||!Number.isInteger(draftYellow)||draftRed<0||draftRed>=draftYellow||draftYellow>=100){toast.error("Enter whole numbers where red is lower than yellow and yellow is below 100.");return}
    setRedMax(draftRed);setYellowMax(draftYellow);localStorage.setItem("ccr-utilization-ranges",JSON.stringify({redMax:draftRed,yellowMax:draftYellow}));setRangeOpen(false);toast.success("Utilization ranges saved");
  };
  const groupStatsFor=(item:(typeof capacityRows)[number]["groups"][number])=>{
    const used=item.days*2+item.mornings+item.afternoons+(item.before??0)+(item.after??0);
    const available=item.capacity*2+(item.before!==null?10:0)+(item.after!==null?10:0);
    const openMorning=Math.max(0,item.capacity-item.days-item.mornings);
    const openAfternoon=Math.max(0,item.capacity-item.days-item.afternoons);
    const openFullDays=Math.min(openMorning,openAfternoon);
    const fragmentedMorning=openMorning-openFullDays;
    const fragmentedAfternoon=openAfternoon-openFullDays;
    const openBefore=item.before!==null?Math.max(0,10-item.before):null;
    const openAfter=item.after!==null?Math.max(0,10-item.after):null;
    return{...item,used,available,openMorning,openAfternoon,openFullDays,fragmentedMorning,fragmentedAfternoon,openBefore,openAfter,open:openMorning+openAfternoon+(openBefore??0)+(openAfter??0),percent:Math.round(used/available*100)};
  };
  const programStats=capacityRows.map(row=>{
    const groupStats=row.groups.map(groupStatsFor);
    const reserved=[
      groupStats.reduce((sum,item)=>sum+item.days,0),
      groupStats.reduce((sum,item)=>sum+item.mornings,0),
      groupStats.reduce((sum,item)=>sum+item.afternoons,0),
      groupStats.every(item=>item.before===null)?null:groupStats.reduce((sum,item)=>sum+(item.before??0),0),
      groupStats.every(item=>item.after===null)?null:groupStats.reduce((sum,item)=>sum+(item.after??0),0),
    ];
    const used=groupStats.reduce((sum,item)=>sum+item.used,0);
    const available=groupStats.reduce((sum,item)=>sum+item.available,0);
    const capacity=groupStats.reduce((sum,item)=>sum+item.capacity,0);
    const openMorning=groupStats.reduce((sum,item)=>sum+item.openMorning,0);
    const openAfternoon=groupStats.reduce((sum,item)=>sum+item.openAfternoon,0);
    const openFullDays=groupStats.reduce((sum,item)=>sum+item.openFullDays,0);
    const fragmentedMorning=groupStats.reduce((sum,item)=>sum+item.fragmentedMorning,0);
    const fragmentedAfternoon=groupStats.reduce((sum,item)=>sum+item.fragmentedAfternoon,0);
    const openBefore=groupStats.every(item=>item.openBefore===null)?null:groupStats.reduce((sum,item)=>sum+(item.openBefore??0),0);
    const openAfter=groupStats.every(item=>item.openAfter===null)?null:groupStats.reduce((sum,item)=>sum+(item.openAfter??0),0);
    const open=groupStats.reduce((sum,item)=>sum+item.open,0);
    return{row,groupStats,reserved,used,available,capacity,open,openMorning,openAfternoon,openFullDays,fragmentedMorning,fragmentedAfternoon,openBefore,openAfter,percent:Math.round(used/available*100)};
  });
  const selectedProgramStats=programStats.find(item=>item.row.group===selectedProgram)??null;
  const periodTotals=reservationPeriods.map((_,index)=>programStats.reduce((sum,item)=>sum+(item.reserved[index]??0),0));
  const totalGroups=capacityRows.reduce((sum,row)=>sum+row.groups.length,0);
  const totalCapacity=programStats.reduce((sum,item)=>sum+item.capacity,0);
  const totalUsed=programStats.reduce((sum,item)=>sum+item.used,0);
  const totalAvailable=programStats.reduce((sum,item)=>sum+item.available,0);
  const totalOpenFullDays=programStats.reduce((sum,item)=>sum+item.openFullDays,0);
  const totalFragmentedMorning=programStats.reduce((sum,item)=>sum+item.fragmentedMorning,0);
  const totalFragmentedAfternoon=programStats.reduce((sum,item)=>sum+item.fragmentedAfternoon,0);
  const totalOpenBefore=programStats.reduce((sum,item)=>sum+(item.openBefore??0),0);
  const totalOpenAfter=programStats.reduce((sum,item)=>sum+(item.openAfter??0),0);
  const totalPercent=Math.round(totalUsed/totalAvailable*100);
  return <section className="panel capacity-overview">
    <Dialog open={rangeOpen} onOpenChange={setRangeOpen}><DialogContent className="threshold-dialog"><DialogHeader><DialogTitle>Set utilization colour ranges</DialogTitle><DialogDescription>Choose the maximum percentage for red and yellow. Green begins automatically above the yellow range.</DialogDescription></DialogHeader><div className="threshold-fields"><div className="threshold-field threshold-red"><Label htmlFor="red-max">Red ends at</Label><div><Input id="red-max" type="number" min="0" max="98" step="1" value={draftRed} onChange={e=>setDraftRed(Number(e.target.value))}/><span>%</span></div><small>Low utilization: 0–{draftRed}%</small></div><div className="threshold-field threshold-yellow"><Label htmlFor="yellow-max">Yellow ends at</Label><div><Input id="yellow-max" type="number" min="1" max="99" step="1" value={draftYellow} onChange={e=>setDraftYellow(Number(e.target.value))}/><span>%</span></div><small>Moderate: {draftRed+1}–{draftYellow}%</small></div><div className="threshold-field threshold-green"><Label>Green begins at</Label><strong>{draftYellow+1}%</strong><small>High utilization: {draftYellow+1}–100%</small></div></div><div className="threshold-actions"><Button variant="ghost" onClick={()=>{setDraftRed(69);setDraftYellow(89)}}>Restore defaults</Button><div><Button variant="outline" onClick={()=>setRangeOpen(false)}>Cancel</Button><Button onClick={saveRanges}>Save ranges</Button></div></div></DialogContent></Dialog>
    <Dialog open={!!selectedProgramStats} onOpenChange={open=>{if(!open)setSelectedProgram(null)}}><DialogContent className="named-groups-dialog">{selectedProgramStats&&<><DialogHeader><DialogTitle>{selectedProgramStats.row.group} named-group registration status</DialogTitle><DialogDescription>{selectedProgramStats.row.groups.length} groups in the {selectedProgramStats.row.months} age range · {selectedProgramStats.capacity} full-day spaces total. Each group is calculated independently.</DialogDescription></DialogHeader><div className="named-groups-list">{selectedProgramStats.groupStats.map(group=>{const tone=utilizationTone(group.percent,redMax,yellowMax);return <article className="named-group-status" key={group.name}><div className="named-group-status-head"><div><b>{group.name}</b><span>{group.capacity} full-day spaces = {group.capacity} AM + {group.capacity} PM</span></div><div className={`named-group-rate ${tone}`}><small>Utilization</small><strong>{group.percent}%</strong></div></div><div className="named-group-reservations"><div><span>Full Day</span><b>{group.days}</b><small>registered</small></div><div><span>Morning / AM</span><b>{group.mornings}</b><small>registered</small></div><div><span>Afternoon / PM</span><b>{group.afternoons}</b><small>registered</small></div>{group.before!==null&&<div><span>Before School</span><b>{group.before}</b><small>registered</small></div>}{group.after!==null&&<div><span>After School</span><b>{group.after}</b><small>registered</small></div>}</div><div className="named-group-open"><b>Open capacity</b><span className="full-day-open">Full Days <strong>{group.openFullDays}</strong></span>{group.fragmentedMorning>0&&<span>AM only <strong>{group.fragmentedMorning}</strong></span>}{group.fragmentedAfternoon>0&&<span>PM only <strong>{group.fragmentedAfternoon}</strong></span>}{group.openBefore!==null&&<span>Before <strong>{group.openBefore}</strong></span>}{group.openAfter!==null&&<span>After <strong>{group.openAfter}</strong></span>}<em>Full days paired first</em></div></article>})}</div></>}</DialogContent></Dialog>
    <div className="panel-head capacity-head">
      <div><h2>Capacity Overview · example</h2><p>Illustrative age-range calculation. Your saved program groups are listed above.</p></div>
      <div className="capacity-controls"><div className="utilization-legend" aria-label="Program utilization percentage legend"><b>Utilization rate</b><span><i className="low"/>0–{redMax}% Low</span><span><i className="medium"/>{redMax+1}–{yellowMax}% Moderate</span><span><i className="high"/>{yellowMax+1}–100% High</span></div><Button variant="outline" size="sm" onClick={onAddGroup}><Plus/> Add a Program Group</Button><Button variant="outline" size="sm" onClick={openRangeSettings}><Settings/> Set ranges</Button></div>
    </div>
    <div className="capacity-formula" aria-label="Age range capacity and open AM and PM calculation">
      <div className="capacity-formula-head"><div><b>How an age range’s capacity is built and tallied</b><span>Every named group’s capacity is added together before registrations are deducted from AM and PM spaces.</span></div><strong>3 groups × 10 = 30 full-day spaces</strong></div>
      <div className="capacity-formula-grid">
        <div className="formula-card formula-capacity"><span>Named Infant groups</span><b>3 groups × 10 spaces</b><small>Infant 1 · Infant 2 · Infant 3</small></div>
        <div className="formula-card"><span>Total full-day capacity</span><b>30 day spaces</b><small>Creates 30 AM + 30 PM spaces</small></div>
        <div className="formula-card"><span>Open AM spaces</span><b>30 − (15 + 6) = 9</b><small>Capacity − (Full Day + Morning/AM)</small></div>
        <div className="formula-card"><span>Open PM spaces</span><b>30 − (15 + 9) = 6</b><small>Capacity − (Full Day + Afternoon/PM)</small></div>
        <div className="formula-card formula-result"><span>Open capacity, full days first</span><b>6 Full Days + 3 AM only</b><small>Pair 6 AM + 6 PM; 3 AM spaces remain</small></div>
      </div>
    </div>
    <div className="capacity-scroll"><div className="capacity-table reservation-table compact-capacity-table">
      <div className="capacity-grid capacity-grid-head"><span>Program age range</span><span>Named groups</span><span>Full-day capacity</span><span>Registered</span><span>Open: full days first</span><span>Utilization</span></div>
      {programStats.map(({row,reserved,used,available,capacity,openFullDays,fragmentedMorning,fragmentedAfternoon,openBefore,openAfter,percent})=>{
        return <div className="capacity-grid capacity-grid-row" key={row.group}>
          <strong className="age-range"><span>{row.group}</span><small>{row.months}</small></strong>
          {row.groups.length>1?<button type="button" className="actual-groups actual-groups-button" onClick={()=>setSelectedProgram(row.group)} aria-label={`View registration status for ${row.group} groups`}><b>{row.groups.length} groups <ChevronDown/></b><small>{row.groups.map(item=>`${item.name} (${item.capacity})`).join(" · ")}</small><em>View registration status</em></button>:<div className="actual-groups"><b>1 group</b><small>{row.groups[0].name} ({row.groups[0].capacity})</small></div>}
          <div className="program-capacity"><b>{capacity}</b><small>Total day spaces</small><small>{capacity} AM + {capacity} PM spaces</small></div>
          <div className="registration-summary"><div className="registration-summary-parts">{reserved.map((count,index)=>count!==null?<span key={compactReservationLabels[index]}><small>{compactReservationLabels[index]}</small><b>{count}</b></span>:<span className="unavailable" key={compactReservationLabels[index]}><small>{compactReservationLabels[index]}</small><b>—</b></span>)}</div></div>
          <div className="open-capacity"><div className="open-capacity-total"><b>{openFullDays}</b><small>Full Days</small></div><div className="open-capacity-parts"><span>AM only <b>{fragmentedMorning}</b></span><span>PM only <b>{fragmentedAfternoon}</b></span>{openBefore!==null&&<span>Before <b>{openBefore}</b></span>}{openAfter!==null&&<span>After <b>{openAfter}</b></span>}</div></div>
          <div className={`utilization-pill ${utilizationTone(percent,redMax,yellowMax)}`}><b>{percent}%</b><small>{used} of {available} spaces used</small></div>
        </div>
      })}
      <div className="capacity-grid capacity-grid-total">
        <strong>All programs</strong>
        <div className="actual-groups"><b>{totalGroups} groups</b><small>Across {capacityRows.length} age ranges</small></div>
        <div className="program-capacity"><b>{totalCapacity}</b><small>Total day spaces</small><small>{totalCapacity} AM + {totalCapacity} PM spaces</small></div>
        <div className="registration-summary"><div className="registration-summary-parts">{periodTotals.map((total,index)=><span key={compactReservationLabels[index]}><small>{compactReservationLabels[index]}</small><b>{total}</b></span>)}</div></div>
        <div className="open-capacity"><div className="open-capacity-total"><b>{totalOpenFullDays}</b><small>Full Days</small></div><div className="open-capacity-parts"><span>AM only <b>{totalFragmentedMorning}</b></span><span>PM only <b>{totalFragmentedAfternoon}</b></span><span>Before <b>{totalOpenBefore}</b></span><span>After <b>{totalOpenAfter}</b></span></div></div>
        <div className={`utilization-pill ${utilizationTone(totalPercent,redMax,yellowMax)}`}><b>{totalPercent}%</b><small>{totalUsed} of {totalAvailable} spaces used</small></div>
      </div>
    </div></div>
    <p className="capacity-note"><b>Open capacity:</b> within each named group, one open AM space and one open PM space are paired and shown as one Full Day opening. Any unpaired AM or PM availability is then shown as an AM-only or PM-only fragment. Before School and After School remain separate 10-space calculations.</p>
  </section>
}
function BusinessDashboard({openWizard}:{openWizard:()=>void}) {
  const [filter,setFilter]=useState("All"); const visible=children.filter(c=>filter==="All"||c.status===filter);
  const [groupOpen,setGroupOpen]=useState(false);
  return <>
    <section className="welcome-row"><div><p className="eyebrow">TUESDAY, SEPTEMBER 23</p><h1>Good morning, Chris</h1><p className="subhead">Here’s what needs attention across your child care business.</p></div><div className="header-actions"><Button variant="outline" onClick={()=>setGroupOpen(true)}><Plus/> Add a Program Group</Button><Button variant="outline" onClick={openWizard}><Link2/> Registration form setup</Button><Button onClick={openWizard}><Plus/> New registration</Button></div></section>
    <section className="metrics-grid"><Metric icon={Baby} label="Active children" value="84" detail="of 92 licensed spaces"/><Metric icon={ClipboardCheck} label="Registrations" value="12" detail="4 need your review" tone="blue"/><Metric icon={CalendarDays} label="Upcoming transitions" value="7" detail="within the next 60 days" tone="amber"/><Metric icon={AlertTriangle} label="Records to update" value="5" detail="2 require attention today" tone="rose"/></section>
    <section className="dashboard-grid"><div className="panel registrations-panel"><div className="panel-head"><div><h2>Registration activity</h2><p>Track every family from invitation to approval.</p></div><Button variant="ghost" size="sm">View all <ArrowRight/></Button></div><div className="table-tools"><div className="search"><Search/><input aria-label="Search registrations" placeholder="Search child or guardian"/></div><div className="filter-pills">{["All","Active","Review","Pending"].map(x=><button key={x} className={filter===x?"active":""} onClick={()=>setFilter(x)}>{x}</button>)}</div></div><div className="child-table"><div className="table-row table-header"><span>Child</span><span>Program</span><span>Completion</span><span>Status</span><span/></div>{visible.map(c=><div className="table-row" key={c.name}><div className="person"><span className={`avatar ${c.color}`}>{c.initials}</span><div><b>{c.name}</b><small>{c.age} · {c.risk}</small></div></div><span>{c.program}</span><div className="completion"><Progress value={c.completion}/><small>{c.completion}%</small></div><Badge className={`status status-${c.status.toLowerCase()}`}>{c.status}</Badge><button aria-label={`Open ${c.name}`}><MoreHorizontal/></button></div>)}</div></div>
      <aside className="right-stack"><div className="panel attention-card"><div className="panel-head"><div><h2>Needs attention</h2><p>Prioritized for you</p></div><span className="count-badge">4</span></div>{[[HeartPulse,"Medication consent expires","Noah Williams · Tomorrow","rose"],[ClipboardCheck,"Registration ready to review","Amelia Brown · 12 min ago","amber"],[Users,"Custody document updated","Ethan Miller · Yesterday","blue"]].map(([I,t,d,c]:any)=><div className="attention-item" key={t}><span className={`attention-icon ${c}`}><I/></span><div><b>{t}</b><p>{d}</p></div><ArrowRight/></div>)}</div><div className="panel ai-card"><div className="ai-top"><span><Sparkles/></span><Badge>AI assistant</Badge></div><h2>3 records may need an update</h2><p>I found conflicting phone numbers and an allergy form that may be out of date.</p><Button variant="outline" onClick={()=>toast("Review queue prepared")}>Review suggestions</Button></div></aside>
    </section>
    <ProgramGroupManager open={groupOpen} onOpenChange={setGroupOpen} onOpenRegistration={openWizard}/>
    <CapacityOverview onAddGroup={()=>setGroupOpen(true)}/>
    <section className="panel transition-panel transition-full"><div className="panel-head"><div><h2>Program transitions</h2><p>Forecasted from birth dates and your program age ranges.</p></div><Button variant="ghost" size="sm">Open planner <ArrowRight/></Button></div>{[["OCT","14","Mia Chen moves to Preschool B","In 21 days · Space reserved","On track","active"],["NOV","03","Oliver Smith moves to Toddler 1","In 41 days · Guardian notice pending","Action needed","review"]].map(r=><div className="timeline" key={r[2]}><div className="month"><span>{r[0]}</span><b>{r[1]}</b></div><div><b>{r[2]}</b><p>{r[3]}</p></div><Badge className={`status status-${r[5]}`}>{r[4]}</Badge></div>)}</section>
  </>;
}
function GuardianDashboard(){return <><section className="welcome-row"><div><p className="eyebrow">FAMILY DASHBOARD</p><h1>Welcome back, Maya</h1><p className="subhead">Keep Mia’s information accurate and see what’s coming next.</p></div><Button onClick={()=>toast.success("Mia’s profile is ready to edit")}><UserRound/> Update information</Button></section><div className="guardian-grid"><section className="panel child-profile-hero"><div className="child-banner"><span className="big-avatar">MC</span><div><Badge className="status status-active"><Check/> Registration complete</Badge><h2>Mia Chen</h2><p>Born January 12, 2023 · Preschool A</p></div></div><div className="profile-progress"><div><span>Profile completion</span><b>100%</b></div><Progress value={100}/></div><div className="milestone"><div className="milestone-icon"><CalendarDays/></div><div><p>NEXT PROGRAM</p><h3>Preschool B</h3><span>Approx. October 14, 2026</span></div><ArrowRight/></div><div className="milestone exit"><div className="milestone-icon"><BookOpen/></div><div><p>EXPECTED PROGRAM END</p><h3>Kindergarten transition</h3><span>Approx. September 1, 2028</span></div></div></section><aside className="right-stack"><div className="panel"><div className="panel-head"><div><h2>Important details</h2><p>Shared with authorized staff</p></div></div>{[[Utensils,"Food & allergies","Peanut allergy"],[HeartPulse,"Medical","EpiPen on site"],[ShieldCheck,"Authorized pickup","3 approved people"]].map(([I,l,v]:any)=><div className="detail-row" key={l}><span><I/></span><div><small>{l}</small><b>{v}</b></div><ArrowRight/></div>)}</div><div className="panel emergency-mini"><FileHeart/><div><h3>Emergency card</h3><p>Updated September 9</p></div><Button variant="outline" size="icon" onClick={()=>toast.success("Emergency card downloaded")}><Download/></Button></div></aside></div><section className="panel action-list"><div className="panel-head"><div><h2>Family checklist</h2><p>Nothing urgent — you’re all caught up.</p></div></div>{["Annual permissions reviewed","Emergency contacts confirmed"].map(x=><div className="done-row" key={x}><CheckCircle2/><div><b>{x}</b><p>Completed September 9, 2026</p></div></div>)}</section></>}
function StaffDashboard(){return <><section className="welcome-row"><div><p className="eyebrow">PRESCHOOL ROOM A · VIEW ONLY</p><h1>Room safety overview</h1><p className="subhead">The essential child information you need today.</p></div><Button variant="outline" onClick={()=>toast.success("Room emergency cards prepared for printing")}><Printer/> Print room cards</Button></section><div className="safety-notice"><LockKeyhole/><div><b>Protected staff view</b><p>Personal billing and registration details are hidden. Access is logged.</p></div></div><section className="metrics-grid staff-metrics"><Metric icon={Users} label="Children today" value="16" detail="2 away"/><Metric icon={Utensils} label="Food alerts" value="4" detail="1 severe allergy" tone="rose"/><Metric icon={HeartPulse} label="Medical plans" value="3" detail="All current" tone="blue"/><Metric icon={ShieldCheck} label="Access restrictions" value="2" detail="Verify photo ID" tone="amber"/></section><section className="panel staff-directory"><div className="panel-head"><div><h2>Child directory</h2><p>Tap a child for approved safety and emergency information.</p></div><div className="search"><Search/><input placeholder="Search room"/></div></div><div className="child-card-grid">{children.map((c,i)=><article className="child-card" key={c.name}><div className="child-card-top"><span className={`avatar ${c.color}`}>{c.initials}</span><div><h3>{c.name}</h3><p>{c.age} · {c.program}</p></div><Badge className={i===2?"status status-active":"status status-review"}>{i===2?"No alerts":"Alert"}</Badge></div><div className="alert-chips">{i!==2&&<span><AlertTriangle/> {c.risk}</span>}<span><Users/> {i===0?"3 approved pickups":"2 approved pickups"}</span></div><div className="guardian-strip"><span className="guardian-photo">{i%2?"DW":"MC"}</span><span className="guardian-photo overlap">{i%2?"KW":"AC"}</span><p>Guardian photos available</p><Button variant="ghost" size="sm">View card <ArrowRight/></Button></div></article>)}</div></section></>}
function OwnerDashboard(){return <><section className="welcome-row"><div><p className="eyebrow">PLATFORM HEALTH</p><h1>ChildCareRegistration.Com</h1><p className="subhead">Business growth, recurring revenue, support, and system activity.</p></div><Button onClick={()=>toast.success("New organization invitation started")}><Plus/> Add organization</Button></section><section className="metrics-grid"><Metric icon={Building2} label="Active businesses" value="247" detail="+12 this month"/><Metric icon={WalletCards} label="Monthly revenue" value="$18,420" detail="96.4% collected" tone="blue"/><Metric icon={Users} label="Child profiles" value="14,862" detail="Across 312 locations" tone="amber"/><Metric icon={MessageCircleQuestion} label="Open support" value="9" detail="2 high priority" tone="rose"/></section><section className="dashboard-grid owner-grid"><div className="panel"><div className="panel-head"><div><h2>Organization health</h2><p>Subscriptions, usage, and account risk.</p></div><Button variant="ghost" size="sm">View all <ArrowRight/></Button></div><div className="org-table table-row table-header"><span>Organization</span><span>Plan</span><span>Children</span><span>Billing</span></div>{[["Little Sprouts Early Learning","Growth","84","Paid"],["Maple Tree Child Care","Annual","126","Paid"],["Bright Start Academy","Growth","52","Past due"],["Tiny Trails Montessori","Starter","38","Trial"]].map(r=><div className="org-table table-row" key={r[0]}><div className="person"><span className="org-logo">{r[0][0]}</span><b>{r[0]}</b></div><span>{r[1]}</span><span>{r[2]}</span><Badge className={`status ${r[3]==="Paid"?"status-active":"status-review"}`}>{r[3]}</Badge></div>)}</div><aside className="right-stack"><div className="panel"><div className="panel-head"><div><h2>Recurring revenue</h2><p>Last 6 months</p></div><Badge>+8.2%</Badge></div><div className="bars">{[48,57,54,68,75,87].map((h,i)=><div key={i} style={{height:h+"%"}}><span>{["Apr","May","Jun","Jul","Aug","Sep"][i]}</span></div>)}</div></div><div className="panel system-card"><div className="system-ok"><CheckCircle2/><div><b>All systems operational</b><p>Last checked 2 minutes ago</p></div></div>{["Registration API","Document service","Connected apps"].map(x=><div className="system-row" key={x}><span>{x}</span><Badge className="status status-active">Operational</Badge></div>)}</div></aside></section></>}
export default function Home(){const[role,setRole]=useState<Role>("business");const[nav,setNav]=useState("Overview");const[menu,setMenu]=useState(false);const meta=roleMeta[role];useEffect(()=>{const saved=localStorage.getItem(`ccr-start-${role}`);const linked=role==="guardian"&&new URLSearchParams(window.location.search).has("registration");setNav(linked?"Child profiles":saved&&navByRole[role].some(item=>item.label===saved)?saved:navByRole[role][0].label);setMenu(false)},[role]);useEffect(()=>{if(new URLSearchParams(window.location.search).get("portal")==="guardian")setRole("guardian")},[]);useEffect(()=>{const mc=(document as any).modelContext;if(!mc?.registerTool)return;const ac=new AbortController();Promise.resolve(mc.registerTool({name:"start_child_registration",title:"Start child registration",description:"Open the new child registration invitation flow.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:()=>{setRole("business");setNav("Registration Form Setup");return{status:"opened"}}},{signal:ac.signal})).catch(()=>{});return()=>ac.abort()},[]);return <div className="app-shell"><Toaster position="top-center" richColors/><aside className={`sidebar ${menu?"open":""}`}><div className="brand"><span className="brand-mark"><Baby/></span><div><b>ChildCare<span>Registration</span></b><small>.COM</small></div><button className="mobile-close" onClick={()=>setMenu(false)}><X/></button></div><div className="location"><div className="location-icon"><Building2/></div><div><small>Viewing as</small><b>{meta.org}</b></div><ChevronDown/></div><nav>{navByRole[role].map(({label,icon:Icon})=><button key={label} className={nav===label?"active":""} onClick={()=>{setNav(label);setMenu(false)}}><Icon/>{label}</button>)}</nav><div className="sidebar-bottom"><button className={nav==="Help & support"?"active":""} onClick={()=>setNav("Help & support")}><MessageCircleQuestion/> Help & support</button><button className={nav==="Settings"?"active":""} onClick={()=>setNav("Settings")}><Settings/> Settings</button><div className="secure-note"><ShieldCheck/><div><b>Secure by design</b><small>Encrypted & access controlled</small></div></div></div></aside><main className="main-area"><header className="topbar"><button className="menu-button" onClick={()=>setMenu(true)}><Menu/></button><div className="global-search"><Search/><span>Search children, guardians, or records</span><kbd>⌘ K</kbd></div><div className="top-actions"><button className="notification"><Bell/><span/></button><Tabs value={role} onValueChange={v=>setRole(v as Role)}><TabsList className="role-tabs"><TabsTrigger value="business">Admin</TabsTrigger><TabsTrigger value="guardian">Guardian</TabsTrigger><TabsTrigger value="staff">Staff</TabsTrigger><TabsTrigger value="owner">Owner</TabsTrigger></TabsList></Tabs><button className="profile"><span>{meta.initials}</span><div><b>{meta.label}</b><small>Demo view</small></div><ChevronDown/></button></div></header><div className="mobile-role"><Tabs value={role} onValueChange={v=>setRole(v as Role)}><TabsList><TabsTrigger value="business">Admin</TabsTrigger><TabsTrigger value="guardian">Guardian</TabsTrigger><TabsTrigger value="staff">Staff</TabsTrigger><TabsTrigger value="owner">Owner</TabsTrigger></TabsList></Tabs></div><div className="content">
{((role==="business"&&nav==="Overview")||(role==="guardian"&&nav==="My family")||(role==="staff"&&nav==="Room overview")||(role==="owner"&&nav==="Platform overview"))&&<p className="portal-sample"><LockKeyhole/> {role==="business"?"Dashboard figures and named people in example panels are illustrative. Saved program groups come from your account.":"Dashboard figures and named people are examples for this demo. Open the registration pages for saved form data."}</p>}
{nav==="Help & support"||nav==="Settings"?<PortalSection role={role} section={nav} onNavigate={setNav}/>:
(role==="guardian"&&nav==="Child profiles")||(role==="owner"&&nav==="Enrollment form")?<EnrollmentWorkspace key={role} role={role as "guardian"|"owner"}/>:
role==="business"&&nav==="Registration Form Setup"?<><AdminIntakeWorkspace/><EnrollmentWorkspace role="business"/></>:
role==="business"&&nav==="Children & guardians"?<><BusinessLocationSettings section="children" onOpenForm={()=>setNav("Registration Form Setup")}/><BusinessChildDirectory/></>:
role==="business"&&nav==="Centre settings"?<BusinessLocationSettings/>:
role==="business"&&nav==="Scheduling"?<SchedulingWorkspace/>:
role==="business"&&nav==="Overview"?<BusinessDashboard openWizard={()=>setNav("Registration Form Setup")}/>:
role==="guardian"&&nav==="My family"?<GuardianDashboard/>:
role==="staff"&&nav==="Room overview"?<StaffDashboard/>:
role==="owner"&&nav==="Platform overview"?<OwnerDashboard/>:
<PortalSection role={role} section={nav} onNavigate={setNav}/>}
</div></main></div>}
