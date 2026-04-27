
--This file has schema, dummy data, all features all in one for testing,
-- 1. Create the database
USE master;
GO

IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'sports_facility_db')
BEGIN
    CREATE DATABASE sports_facility_db;
END
GO

-- 2. Switch to the new database context
USE sports_facility_db;
GO



-- sports facility booking & automation system v2.2
-- finalized schema 
-- drop tables in reverse order of dependencies

drop table if exists audit_logs;
drop table if exists notifications;
drop table if exists reviews;
drop table if exists payments;
drop table if exists waitlists;
drop table if exists bids;
drop table if exists equipment_rentals;
drop table if exists equipment;
drop table if exists maintenance_schedules;
drop table if exists bookings;
drop table if exists timeslots;
drop table if exists facilities;
drop table if exists users;
drop table if exists memberships;
drop table if exists coupons;

-- 1. support tables
create table memberships (
    membershipid int identity(1,1) primary key,
    tiername varchar(50) not null,
    discountpct int default 0 check (discountpct between 0 and 100)
);

create table coupons (
    couponid int identity(1,1) primary key,
    code varchar(20) unique not null,
    discountval decimal(10,2) not null
);

-- 2. user management
create table users (
    userid int identity(1,1) primary key,
    username varchar(50) unique not null,
    passwordhash varchar(255) not null,
    email varchar(100) unique not null,
    role varchar(20) not null check (role in ('student', 'staff', 'admin')),
    fullname varchar(100),
    phonenumber varchar(20),
    membershipid int,
    createdat datetime default getdate(),
    lastlogin datetime,
    foreign key (membershipid) references memberships(membershipid) on delete set null
);

-- 3. facility management
create table facilities (
    facilityid int identity(1,1) primary key,
    name varchar(100) not null,
    description text,
    capacity int not null check (capacity > 0),
    is_auctionable bit default 0, -- 1 for true (bidding allowed)
    isactive bit default 1,
    createdat datetime default getdate()
);

create table timeslots (
    slotid int identity(1,1) primary key,
    starttime time not null,
    endtime time not null
);

create table maintenance_schedules (
    maintenanceid int identity(1,1) primary key,
    facilityid int not null,
    maintdate date not null,
    reason text,
    foreign key (facilityid) references facilities(facilityid) on delete cascade
);

-- 4. core booking & bidding
create table bookings (
    bookingid int identity(1,1) primary key,
    userid int not null,
    facilityid int not null,
    slotid int not null,
    bookingdate date not null,
    finalprice decimal(10,2) default 0.00,
    status varchar(20) default 'pending' 
        check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'open_bid')),
    createdat datetime default getdate(),
    foreign key (userid) references users(userid) on delete cascade,
    foreign key (facilityid) references facilities(facilityid) on delete cascade,
    foreign key (slotid) references timeslots(slotid)
);

create table bids (
    bidid int identity(1,1) primary key,
    bookingid int not null,
    userid int not null,
    bidamount decimal(10,2) not null,
    bidtime datetime default getdate(),
    foreign key (bookingid) references bookings(bookingid) on delete cascade,
    foreign key (userid) references users(userid)
);

-- 5. inventory & logistics
create table equipment (
    itemid int identity(1,1) primary key,
    itemname varchar(100) not null,
    hourlyrate decimal(10,2) default 0.00
);

create table equipment_rentals (
    rentalid int identity(1,1) primary key,
    bookingid int not null,
    itemid int not null,
    qty int default 1,
    foreign key (bookingid) references bookings(bookingid) on delete cascade,
    foreign key (itemid) references equipment(itemid)
);

-- 6. automation & feedback layers
create table waitlists (
    waitlistid int identity(1,1) primary key,
    bookingid int not null,
    userid int not null,
    prioritylevel int default 1,
    joinedat datetime default getdate(),
    foreign key (bookingid) references bookings(bookingid) on delete cascade,
    foreign key (userid) references users(userid)
);

create table payments (
    paymentid int identity(1,1) primary key,
    bookingid int not null,
    amount decimal(10,2) not null,
    paymentmethod varchar(50),
    paymentdate datetime default getdate(),
    foreign key (bookingid) references bookings(bookingid) on delete cascade
);

create table reviews (
    reviewid int identity(1,1) primary key,
    userid int not null,
    facilityid int not null,
    rating int check (rating between 1 and 5),
    comment text,
    foreign key (userid) references users(userid),
    foreign key (facilityid) references facilities(facilityid)
);

create table notifications (
    notifid int identity(1,1) primary key,
    userid int not null,
    message nvarchar(max),
    isread bit default 0,
    createdat datetime default getdate(),
    foreign key (userid) references users(userid) on delete cascade
);

create table audit_logs (
    logid int identity(1,1) primary key,
    adminid int,
    actionperformed nvarchar(max),
    createdat datetime default getdate(),
    foreign key (adminid) references users(userid) on delete set null
);

--  prevent double-booking at the database level
alter table bookings 
add constraint uc_facility_slot_date unique (facilityid, slotid, bookingdate);







use sports_facility_db;
go

-----------------------------------------------------------
-- 1. memberships & users (20 users across all roles)
-----------------------------------------------------------
insert into memberships (tiername, discountpct) values 
('standard student', 0), ('staff silver', 10), ('varsity gold', 25), ('alumni premium', 5);

-- admins
insert into users (username, passwordhash, email, role, fullname, phonenumber, membershipid) values 
('admin_chief', 'hash1', 'chief@uni.edu', 'admin', 'robert manager', '555-9000', null),
('admin_coord', 'hash2', 'coord@uni.edu', 'admin', 'sarah logistics', '555-9001', null);

-- students & staff (mix of tiers)
insert into users (username, passwordhash, email, role, fullname, phonenumber, membershipid) values 
('jdoe', 'h', 'j.doe@uni.edu', 'student', 'john doe', '555-1001', 1),
('asmith', 'h', 'a.smith@uni.edu', 'staff', 'alice smith', '555-1002', 2),
('mplayer', 'h', 'm.p@uni.edu', 'student', 'mike player', '555-1003', 3),
('sreader', 'h', 'sara@uni.edu', 'student', 'sara reader', '555-1004', 1),
('bwhite', 'h', 'bw@uni.edu', 'student', 'bob white', '555-1005', 3),
('tgreen', 'h', 'tg@uni.edu', 'staff', 'tom green', '555-1006', 2),
('kblack', 'h', 'kb@uni.edu', 'student', 'kelly black', '555-1007', 1),
('vking', 'h', 'vk@uni.edu', 'student', 'victor king', '555-1008', 3),
('lqueen', 'h', 'lq@uni.edu', 'student', 'laura queen', '555-1009', 1),
('dknight', 'h', 'dk@uni.edu', 'staff', 'david knight', '555-1010', 2);

-----------------------------------------------------------
-- 2. facilities & timeslots (full campus variety)
-----------------------------------------------------------
insert into facilities (name, description, capacity, is_auctionable, isactive) values 
('cricket stadium', 'main arena', 100, 1, 1),
('tennis court 1', 'hard court', 4, 0, 1),
('tennis court 2', 'clay court', 4, 0, 1),
('main gym', 'weights & cardio', 40, 0, 1),
('olympic pool', '50m lanes', 25, 0, 1),
('basketball court a', 'indoor', 12, 1, 1),
('squash court 1', 'glass back', 2, 0, 1),
('football field', 'turf', 22, 1, 1),
('badminton hall', '4 courts', 16, 0, 1),
('yoga studio', 'matted room', 20, 0, 1);

-- full day slots
insert into timeslots (starttime, endtime) values 
('07:00:00', '08:00:00'), ('08:00:00', '09:00:00'), ('09:00:00', '10:00:00'), 
('10:00:00', '11:00:00'), ('11:00:00', '12:00:00'), ('12:00:00', '13:00:00'),
('13:00:00', '14:00:00'), ('14:00:00', '15:00:00'), ('15:00:00', '16:00:00'),
('16:00:00', '17:00:00'), ('17:00:00', '18:00:00'), ('18:00:00', '19:00:00'),
('19:00:00', '20:00:00'), ('20:00:00', '21:00:00');

-----------------------------------------------------------
-- 3. bookings: historical, future, and bidding
-----------------------------------------------------------
-- historical completed bookings (for revenue/popularity reports)
insert into bookings (userid, facilityid, slotid, bookingdate, finalprice, status) values 
(3, 4, 2, '2026-03-01', 15.00, 'completed'),
(5, 4, 3, '2026-03-01', 15.00, 'completed'),
(7, 2, 5, '2026-03-01', 20.00, 'completed');

-- active auctions (bidding war)
insert into bookings (userid, facilityid, slotid, bookingdate, finalprice, status) values 
(5, 1, 12, cast(getdate() as date), 100.00, 'open_bid'), -- cricket ground tonight
(8, 8, 11, cast(getdate() as date), 80.00, 'open_bid');  -- football field

-- multiple bids for the cricket stadium
insert into bids (bookingid, userid, bidamount) values 
(4, 4, 110.00), (4, 6, 125.00), (4, 4, 140.00), (4, 9, 155.00);

-- confirmed bookings (to test availability logic)
insert into bookings (userid, facilityid, slotid, bookingdate, finalprice, status) values 
(4, 2, 4, cast(getdate() as date), 20.00, 'confirmed'),
(6, 2, 5, cast(getdate() as date), 20.00, 'confirmed');

-----------------------------------------------------------
-- 4. maintenance, waitlists & rentals
-------------------------------------------
-- test the "conflict checker" (pool is closed tomorrow)
insert into maintenance_schedules (facilityid, maintdate, reason) values 
(5, cast(getdate() + 1 as date), 'leak repair');

-- test waitlist promotion (3 people waiting for court 1)
insert into waitlists (bookingid, userid, prioritylevel) values 
(6, 7, 1), (6, 9, 2), (6, 10, 3);

-- equipment & active rentals
insert into equipment (itemname, hourlyrate) values 
('pro racket', 10.00), ('football kit', 15.00), ('shuttlecocks (pk)', 2.00), ('yoga mat', 0.00);

insert into equipment_rentals (bookingid, itemid, qty) values (6, 1, 2);

-----------------------------------------------------------
-- 5. engagement & finance
-------------------------------------------
insert into reviews (userid, facilityid, rating, comment) values 
(3, 4, 5, 'best gym on campus!'), (5, 4, 4, 'very clean'), (7, 2, 2, 'net is a bit loose');

insert into payments (bookingid, amount, paymentmethod) values 
(1, 15.00, 'cash'), (3, 20.00, 'credit card'), (6, 20.00, 'wallet');

insert into notifications (userid, message, isread) values 
(7, 'warning: unpaid penalty for late return', 0),
(4, 'you are currently the highest bidder for cricket stadium', 1);

insert into audit_logs (adminid, actionperformed) values 
(1, 'updated pricing for varsity members'), (2, 'scheduled maintenance for pool');
go



















-- sports_facility_phase2


-- sports_facility_phase2_logic.sql
-- includes batch separators, feature descriptions, and instant test commands

-----------------------------------------------------------
-- module 1: advanced booking & automation logic
-----------------------------------------------------------

-- 1. smart availability search
-- returns slots that are active and have no existing bookings or maintenance records for a given date.
go
create procedure sp_get_available_facilities @targetdate date
as
begin
    select f.facilityid, f.name, t.slotid, t.starttime, t.endtime
    from facilities f
    cross join timeslots t
    where f.isactive = 1
    and not exists (
        select 1 from bookings b 
        where b.facilityid = f.facilityid 
        and b.slotid = t.slotid 
        and b.bookingdate = @targetdate 
        and b.status in ('confirmed', 'pending')
    )
    and not exists (
        select 1 from maintenance_schedules m 
        where m.facilityid = f.facilityid 
        and m.maintdate = @targetdate
    );
end;
go
-- test execution:
exec sp_get_available_facilities @targetdate = '2026-03-05';
go

-- 2. next-available suggester
-- provides a quick list of 10 upcoming empty slots across the campus to help users find immediate alternatives.
create view view_next_available_slots as
select top 10 f.name as facility, t.starttime, t.endtime
from facilities f
cross join timeslots t
left join bookings b on f.facilityid = b.facilityid and t.slotid = b.slotid
where b.bookingid is null and f.isactive = 1;
go
-- test execution:
select * from view_next_available_slots;
go

-- 3. waitlist auto-promotion selector
-- identifies the user with the highest priority in the waitlist for a specific booking that might have been cancelled.
create view view_waitlist_priority as
select w.waitlistid, w.bookingid, u.fullname, w.prioritylevel
from waitlists w
join users u on w.userid = u.userid
where w.prioritylevel = (select max(prioritylevel) from waitlists where bookingid = w.bookingid);
go
-- test execution:
select * from view_waitlist_priority;
go

-- 4. conflict prevention check
-- flags existing bookings that overlap with newly scheduled maintenance to notify users of cancellations.
create view view_booking_conflicts as
select b.bookingid, f.name as facility, b.bookingdate, m.reason as maintenance_reason
from bookings b
join maintenance_schedules m on b.facilityid = m.facilityid and b.bookingdate = m.maintdate
join facilities f on b.facilityid = f.facilityid;
go
-- test execution:
select * from view_booking_conflicts;
go

-----------------------------------------------------------
-- module 2: the bidding engine
-----------------------------------------------------------

-- 5. live auction leaderboard
-- displays all facilities currently open for bidding along with the highest bid amount to date.
create view view_active_auctions as
select b.bookingid, f.name as facility, b.bookingdate, max(bi.bidamount) as current_highest_bid
from bookings b
join facilities f on b.facilityid = f.facilityid
left join bids bi on b.bookingid = bi.bookingid
where b.status = 'open_bid'
group by b.bookingid, f.name, b.bookingdate;
go
-- test execution:
select * from view_active_auctions;
go

-- 6. user bid history tracker
-- allows a user to track their bid status (winning/outbid) for all auctions they have participated in.
create procedure sp_get_user_bids @userid int
as
begin
    select b.bookingid, f.name, bi.bidamount, bi.bidtime, 
           case when bi.bidamount = (select max(bidamount) from bids where bookingid = b.bookingid) then 'winning' else 'outbid' end as bid_status
    from bids bi
    join bookings b on bi.bookingid = b.bookingid
    join facilities f on b.facilityid = f.facilityid
    where bi.userid = @userid;
end;
go
-- test execution (testing for user id 4 - mike player):
exec sp_get_user_bids @userid = 4;
go

-- 7. winning bid finalizer
-- isolates the winning user and their final price once an auction window has concluded.
create view view_auction_winners as
select bi.bookingid, bi.userid as winner_id, bi.bidamount as final_price
from bids bi
where bi.bidamount = (select max(bidamount) from bids where bookingid = bi.bookingid);
go
-- test execution:
select * from view_auction_winners;
go

-----------------------------------------------------------
-- module 3: financials & monetization
-----------------------------------------------------------

-- 8. revenue heatmap (monthly)
-- aggregates all payment data to show total university sports revenue grouped by month.
create view view_monthly_revenue as
select format(paymentdate, 'yyyy-MM') as month, sum(amount) as total_revenue
from payments
group by format(paymentdate, 'yyyy-MM');
go
-- test execution:
select * from view_monthly_revenue;
go

-- 9. membership discount calculator
-- dynamically adjusts the base price of a booking based on the student's membership tier (e.g., gold, varsity).
create procedure sp_calculate_discounted_price @userid int, @baseprice decimal(10,2)
as
begin
    select @baseprice - (@baseprice * (m.discountpct / 100.0)) as final_price
    from users u
    join memberships m on u.membershipid = m.membershipid
    where u.userid = @userid;
end;
go
-- test execution (testing for user id 5 - varsity tier):
exec sp_calculate_discounted_price @userid = 5, @baseprice = 100.00;
go

-- 10. coupon validator
-- verifies a coupon code's existence and retrieves its fixed discount value for the checkout process.
create procedure sp_validate_coupon @code varchar(20)
as
begin
    select couponid, discountval from coupons where code = @code;
end;
go
-- test execution:
exec sp_validate_coupon @code = 'WELCOME10';
go

-- 11. unpaid penalty block check
-- checks if a user has unread penalty notifications, which can be used to restrict them from making new bookings.
create procedure sp_check_user_status @userid int
as
begin
    select count(*) as active_penalties 
    from notifications 
    where userid = @userid and message like '%penalty%' and isread = 0;
end;
go
-- test execution (user id 7 has a penalty):
exec sp_check_user_status @userid = 7;
go

-----------------------------------------------------------
-- module 4: inventory & equipment
-----------------------------------------------------------

-- 12. real-time inventory check
-- tracks current rental volume against total equipment stock to prevent over-renting gear.
create view view_equipment_availability as
select itemname, hourlyrate, 
       (select count(*) from equipment_rentals where itemid = e.itemid) as currently_rented
from equipment e;
go
-- test execution:
select * from view_equipment_availability;
go

-- 13. rental attachment query
-- retrieves a specific list of gear rented for a single booking id to assist staff during equipment handout.
create procedure sp_get_booking_rentals @bookingid int
as
begin
    select e.itemname, er.qty
    from equipment_rentals er
    join equipment e on er.itemid = e.itemid
    where er.bookingid = @bookingid;
end;
go
-- test execution:
exec sp_get_booking_rentals @bookingid = 6;
go

-----------------------------------------------------------
-- module 5: admin analytics & reports
-----------------------------------------------------------

-- 14. top 5 most popular facilities
-- ranks facilities by total booking count to identify the most utilized sports venues on campus.
create view view_top_facilities as
select top 5 f.name, count(b.bookingid) as times_booked
from facilities f
left join bookings b on f.facilityid = b.facilityid
group by f.name
order by times_booked desc;
go
-- test execution:
select * from view_top_facilities;
go

-- 15. peak usage hours
-- identifies which timeslots throughout the day see the highest volume of activity across all facilities.
create view view_peak_hours as
select t.starttime, t.endtime, count(b.bookingid) as frequency
from timeslots t
join bookings b on t.slotid = b.slotid
group by t.starttime, t.endtime;
go
-- test execution:
select * from view_peak_hours;
go

-- 16. user engagement leaderboard
-- highlights the top 10 students/staff with the most bookings to encourage and reward high sports participation.
create view view_power_users as
select top 10 u.fullname, count(b.bookingid) as total_bookings
from users u
join bookings b on u.userid = b.userid
group by u.fullname
order by total_bookings desc;
go
-- test execution:
select * from view_power_users;
go

-- 17. facility health report
-- compares the number of maintenance days against active booking days to evaluate facility wear-and-tear.
create view view_facility_health as
select f.name, 
       (select count(*) from maintenance_schedules where facilityid = f.facilityid) as maintenance_days,
       (select count(*) from bookings where facilityid = f.facilityid) as active_days
from facilities f;
go
-- test execution:
select * from view_facility_health;
go

-- 18. feedback & sentiment analysis
-- calculates the average star rating and total review count per facility based on user feedback.
create view view_facility_ratings as
select f.name, avg(cast(r.rating as decimal(10,2))) as average_rating, count(r.reviewid) as total_reviews
from facilities f
left join reviews r on f.facilityid = r.facilityid
group by f.name;
go
-- test execution:
select * from view_facility_ratings;
go