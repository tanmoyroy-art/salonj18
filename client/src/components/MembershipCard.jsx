import React from "react";

const CARD_THEME = {
    basic: {
        background: "linear-gradient(135deg,#2D3748,#4A5568)",
        accent: "#CBD5E0",
        text: "#FFFFFF"
    },
    gold: {
        background: "linear-gradient(135deg,#8B6914,#F6C343,#D4AF37)",
        accent: "#FFF3C4",
        text: "#FFFFFF"
    },
    diamond: {
        background: "linear-gradient(135deg,#141E30,#243B55,#6A11CB)",
        accent: "#D6BCFA",
        text: "#FFFFFF"
    }
};

export default function MembershipCard({ data, onClose }) {
    if (!data) return null;
    const tier = (data.tier || "basic").toLowerCase();
    const theme = CARD_THEME[tier] || CARD_THEME.basic;
    const printCard = () => {
        window.print();
    };

    return (
        <>
            <style>{`
                .membership-overlay{
                    position:fixed;
                    inset:0;
                    background:rgba(0,0,0,.65);
                    display:flex;
                    justify-content:center;
                    align-items:center;
                    z-index:9999;
                }
                .membership-modal{
                    width:850px;
                    max-width:95%;
                    background:#fff;
                    border-radius:15px;
                    padding:25px;
                }
                .membership-card{
                    width:100%;
                    max-width:650px;
                    height:390px;
                    margin:auto;
                    border-radius:22px;
                    padding:30px;
                    position:relative;
                    overflow:hidden;
                    color:${theme.text};
                    background:${theme.background};
                    box-shadow:0 15px 40px rgba(0,0,0,.35);
                }
                .membership-card::before{
                    content:"";
                    position:absolute;
                    width:350px;
                    height:350px;
                    background:rgba(255,255,255,.08);
                    border-radius:50%;
                    top:-150px;
                    right:-120px;
                }
                .membership-card::after{
                    content:"";
                    position:absolute;
                    width:250px;
                    height:250px;
                    background:rgba(255,255,255,.05);
                    border-radius:50%;
                    bottom:-120px;
                    left:-80px;
                }
                .chip{
                    width:70px;
                    height:55px;
                    border-radius:10px;
                    background:linear-gradient(#f8e9a1,#c7a740);
                    margin-top:25px;
                }
                .membership-id{
                    margin-top:35px;
                    font-size:28px;
                    letter-spacing:4px;
                    font-weight:bold;
                }
                .member-name{
                    font-size:24px;
                    margin-top:4px;
                    font-weight:700;
                }
                .footer{
                    display:flex;
                    justify-content:space-between;
                    margin-top:40px;
                    font-size:15px;
                }
                .type-badge{
                    padding:8px 18px;
                    border-radius:20px;
                    background:rgba(255,255,255,.2);
                    font-weight:bold;
                    text-transform:uppercase;
                }
                .action-buttons{
                    display:flex;
                    justify-content:center;
                    gap:15px;
                    margin-top:25px;
                }
                @media print{
                    body *{
                        visibility:hidden;
                    }
                    #printCard,
                    #printCard *{
                        visibility:visible;
                    }
                    #printCard{
                        position:absolute;
                        left:0;
                        top:0;
                        width:100%;
                    }
                    .action-buttons{
                        display:none;
                    }
                    .membership-overlay{
                        background:white;
                    }
                    .membership-modal{
                        box-shadow:none;
                    }
                }
            `}</style>

            <div className="membership-overlay">
                <div className="membership-modal">
                    <div id="printCard">
                        <div className="membership-card">
                            <div style={{ display:"flex", justifyContent:"space-between" }}>
                                <div>
                                    <div style={{ fontSize:34, fontWeight:"bold" }}> J Eighteen </div>
                                    <div style={{ fontSize:18, opacity:.9 }}> Beauty Salon Academy </div>
                                </div>
                                <div className="type-badge" style={{ color:theme.accent }}>
                                    {data.plan_name}
                                </div>
                            </div>
                            <div className="chip"></div>
                            <div className="membership-id">
                                {data.membership_card_id}
                            </div>
                            <div className="member-name">
                                {data.name}
                            </div>
                            <div className="footer">
                                <div>
                                    <small>PHONE</small>
                                    <br />
                                    {data.phone}
                                </div>
                                <div>
                                    <small>VALID UPTO</small>
                                    <br />
                                    {new Date(data.end_date).toLocaleDateString("en-IN")}
                                </div>
                                <div>
                                    <small>DISCOUNT</small>
                                    <br />
                                    {data.discount_percent}%
                                </div>
                            </div>
                            <div style={{ position:"absolute", right:30, bottom:43, fontSize:13, opacity:.75 }}> www.j18.in </div>
                        </div>
                    </div>
                    <div className="action-buttons">
                        <button className="btn btn-primary" onClick={printCard}> 🖨 Print Card</button>
                        <button className="btn btn-secondary" onClick={onClose}> Close</button>
                    </div>
                </div>
            </div>
        </>
    );
}