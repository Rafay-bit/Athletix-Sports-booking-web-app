-- ═══════════════════════════════════════════════════════════════════════════════
-- SPORTS FACILITY BOOKING & AUTOMATION SYSTEM v2.3
-- Single unified file: Schema + Views/SPs + Lahore Seed Data
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 1: SCHEMA (DDL)
-- ═══════════════════════════════════════════════════════════════════════════════

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
    is_auctionable bit default 0,
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
    couponid int,
    bookingdate date not null,
    finalprice decimal(10,2) default 0.00,
    status varchar(20) default 'pending' 
        check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'open_bid')),
    createdat datetime default getdate(),
    foreign key (userid) references users(userid) on delete cascade,
    foreign key (facilityid) references facilities(facilityid) on delete cascade,
    foreign key (slotid) references timeslots(slotid),
    foreign key (couponid) references coupons(couponid) on delete set null
);

create table bids (
    bidid int identity(1,1) primary key,
    bookingid int not null,
    userid int not null,
    bidamount decimal(10,2) not null,
    bidtime datetime default getdate(),
    foreign key (bookingid) references bookings(bookingid) on delete cascade,
    foreign key (userid) references users(userid) on delete no action
);

-- 5. inventory & logistics
create table equipment (
    itemid int identity(1,1) primary key,
    itemname varchar(100) not null,
    totalstock int default 1,
    hourlyrate decimal(10,2) default 0.00
);

create table equipment_rentals (
    rentalid int identity(1,1) primary key,
    bookingid int not null,
    itemid int not null,
    qty int default 1,
    foreign key (bookingid) references bookings(bookingid) on delete cascade,
    foreign key (itemid) references equipment(itemid) on delete cascade
);

-- 6. automation & feedback layers
create table waitlists (
    waitlistid int identity(1,1) primary key,
    bookingid int not null,
    userid int not null,
    prioritylevel int default 1,
    joinedat datetime default getdate(),
    foreign key (bookingid) references bookings(bookingid) on delete cascade,
    foreign key (userid) references users(userid) on delete no action
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
    foreign key (userid) references users(userid) on delete cascade,
    foreign key (facilityid) references facilities(facilityid) on delete cascade
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

-- prevent double-booking at the database level
alter table bookings 
add constraint uc_facility_slot_date unique (facilityid, slotid, bookingdate);


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 2: DQL FEATURES (Views & Stored Procedures) — 18 features, 5 modules
-- ═══════════════════════════════════════════════════════════════════════════════

-----------------------------------------------------------
-- module 1: advanced booking & automation logic
-----------------------------------------------------------

-- 1. smart availability search
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

-- 2. next-available suggester
create view view_next_available_slots as
select top 10 f.name as facility, t.starttime, t.endtime
from facilities f
cross join timeslots t
left join bookings b on f.facilityid = b.facilityid and t.slotid = b.slotid
where b.bookingid is null and f.isactive = 1;
go

-- 3. waitlist auto-promotion selector
create view view_waitlist_priority as
select w.waitlistid, w.bookingid, u.fullname, w.prioritylevel
from waitlists w
join users u on w.userid = u.userid
where w.prioritylevel = (select max(prioritylevel) from waitlists where bookingid = w.bookingid);
go

-- 4. conflict prevention check
create view view_booking_conflicts as
select b.bookingid, f.name as facility, b.bookingdate, m.reason as maintenance_reason
from bookings b
join maintenance_schedules m on b.facilityid = m.facilityid and b.bookingdate = m.maintdate
join facilities f on b.facilityid = f.facilityid;
go

-----------------------------------------------------------
-- module 2: the bidding engine
-----------------------------------------------------------

-- 5. live auction leaderboard
create view view_active_auctions as
select b.bookingid, f.name as facility, b.bookingdate, max(bi.bidamount) as current_highest_bid
from bookings b
join facilities f on b.facilityid = f.facilityid
left join bids bi on b.bookingid = bi.bookingid
where b.status = 'open_bid'
group by b.bookingid, f.name, b.bookingdate;
go

-- 6. user bid history tracker
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

-- 7. winning bid finalizer
create view view_auction_winners as
select bi.bookingid, bi.userid as winner_id, bi.bidamount as final_price
from bids bi
where bi.bidamount = (select max(bidamount) from bids where bookingid = bi.bookingid);
go

-----------------------------------------------------------
-- module 3: financials & monetization
-----------------------------------------------------------

-- 8. revenue heatmap (monthly)
create view view_monthly_revenue as
select format(paymentdate, 'yyyy-MM') as month, sum(amount) as total_revenue
from payments
group by format(paymentdate, 'yyyy-MM');
go

-- 9. membership discount calculator
create procedure sp_calculate_discounted_price @userid int, @baseprice decimal(10,2)
as
begin
    select @baseprice - (@baseprice * (m.discountpct / 100.0)) as final_price
    from users u
    join memberships m on u.membershipid = m.membershipid
    where u.userid = @userid;
end;
go

-- 10. coupon validator
create procedure sp_validate_coupon @code varchar(20)
as
begin
    select couponid, discountval from coupons where code = @code;
end;
go

-- 11. unpaid penalty block check
create procedure sp_check_user_status @userid int
as
begin
    select count(*) as active_penalties 
    from notifications 
    where userid = @userid and message like '%penalty%' and isread = 0;
end;
go

-----------------------------------------------------------
-- module 4: inventory & equipment
-----------------------------------------------------------

-- 12. real-time inventory check
create view view_equipment_availability as
select itemname, totalstock, hourlyrate, 
       (select isnull(sum(qty), 0) from equipment_rentals where itemid = e.itemid) as currently_rented,
       e.totalstock - (select isnull(sum(qty), 0) from equipment_rentals where itemid = e.itemid) as available_stock
from equipment e;
go

-- 13. rental attachment query
create procedure sp_get_booking_rentals @bookingid int
as
begin
    select e.itemname, er.qty
    from equipment_rentals er
    join equipment e on er.itemid = e.itemid
    where er.bookingid = @bookingid;
end;
go

-----------------------------------------------------------
-- module 5: admin analytics & reports
-----------------------------------------------------------

-- 14. top 5 most popular facilities
create view view_top_facilities as
select top 5 f.name, count(b.bookingid) as times_booked
from facilities f
left join bookings b on f.facilityid = b.facilityid
group by f.name
order by times_booked desc;
go

-- 15. peak usage hours
create view view_peak_hours as
select t.starttime, t.endtime, count(b.bookingid) as frequency
from timeslots t
join bookings b on t.slotid = b.slotid
group by t.starttime, t.endtime;
go

-- 16. user engagement leaderboard
create view view_power_users as
select top 10 u.fullname, count(b.bookingid) as total_bookings
from users u
join bookings b on u.userid = b.userid
group by u.fullname
order by total_bookings desc;
go

-- 17. facility health report
create view view_facility_health as
select f.name, 
       (select count(*) from maintenance_schedules where facilityid = f.facilityid) as maintenance_days,
       (select count(*) from bookings where facilityid = f.facilityid) as active_days
from facilities f;
go

-- 18. feedback & sentiment analysis
create view view_facility_ratings as
select f.name, avg(cast(r.rating as float)) as avg_rating, count(r.reviewid) as review_count
from facilities f
left join reviews r on f.facilityid = r.facilityid
group by f.name;
go

-- 19. admin summary stats
create view view_admin_stats as
select 
    (select count(*) from users) as total_users,
    (select count(*) from facilities) as total_facilities,
    (select count(*) from bookings) as total_bookings,
    (select isnull(sum(totalstock), 0) from equipment) as total_equipment,
    (select isnull(sum(finalprice), 0) from bookings where status = 'confirmed') as total_revenue;
go
select f.name, avg(cast(r.rating as decimal(10,2))) as average_rating, count(r.reviewid) as total_reviews
from facilities f
left join reviews r on f.facilityid = r.facilityid
group by f.name;
go


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 3: SEED DATA — Real Lahore Sports Facilities & Sample Records
-- ═══════════════════════════════════════════════════════════════════════════════

-----------------------------------------------------------
-- memberships & coupons
-----------------------------------------------------------
insert into memberships (tiername, discountpct) values
('Basic',   0),
('Silver', 10),
('Gold',   20),
('Varsity', 30);

insert into coupons (code, discountval) values
('LAHORE10',   10.00),
('SUMMER25',   25.00),
('WELCOME50',  50.00),
('SPORTS15',   15.00),
('CRICKET20',  20.00);

-----------------------------------------------------------
-- users (students, staff, admins from Lahore)
-----------------------------------------------------------
-- All passwords are: 1234 (bcrypt hashed)
insert into users (username, passwordhash, email, role, fullname, phonenumber, membershipid) values
('ahmadraza',    '$2b$10$4rcA5yjFys9E6GjPlNuOhu3/gY1VPglgPSwlcG6bTqTlf9XkcUAvy', 'ahmad.raza@student.lhr.edu',       'student', 'Ahmad Raza',          '+92-321-4501234', 1),
('sanamalik',    '$2b$10$4rcA5yjFys9E6GjPlNuOhu3/gY1VPglgPSwlcG6bTqTlf9XkcUAvy', 'sana.malik@student.lhr.edu',       'student', 'Sana Malik',          '+92-300-9876543', 2),
('usmankhan',    '$2b$10$4rcA5yjFys9E6GjPlNuOhu3/gY1VPglgPSwlcG6bTqTlf9XkcUAvy', 'usman.khan@student.lhr.edu',       'student', 'Usman Khan',          '+92-333-1112233', 3),
('ayeshafatima', '$2b$10$4rcA5yjFys9E6GjPlNuOhu3/gY1VPglgPSwlcG6bTqTlf9XkcUAvy', 'ayesha.fatima@student.lhr.edu',    'student', 'Ayesha Fatima',       '+92-312-5554433', 4),
('hamzaali',     '$2b$10$4rcA5yjFys9E6GjPlNuOhu3/gY1VPglgPSwlcG6bTqTlf9XkcUAvy', 'hamza.ali@student.lhr.edu',        'student', 'Hamza Ali',           '+92-345-7778899', 2),
('farhanch',     '$2b$10$4rcA5yjFys9E6GjPlNuOhu3/gY1VPglgPSwlcG6bTqTlf9XkcUAvy', 'farhan.chaudhry@staff.lhr.edu',    'staff',   'Farhan Chaudhry',     '+92-301-2223344', 3),
('noureenakhtar','$2b$10$4rcA5yjFys9E6GjPlNuOhu3/gY1VPglgPSwlcG6bTqTlf9XkcUAvy', 'noureen.akhtar@staff.lhr.edu',     'staff',   'Noureen Akhtar',      '+92-322-6667788', 2),
('zubairhassan', '$2b$10$4rcA5yjFys9E6GjPlNuOhu3/gY1VPglgPSwlcG6bTqTlf9XkcUAvy', 'zubair.hassan@staff.lhr.edu',      'staff',   'Zubair Hassan',       '+92-311-4445566', 1),
('adminasad',    '$2b$10$4rcA5yjFys9E6GjPlNuOhu3/gY1VPglgPSwlcG6bTqTlf9XkcUAvy', 'asad.admin@sportshub.lhr.edu',     'admin',   'Asad Mehmood',        '+92-300-1110000', 4),
('adminrabia',   '$2b$10$4rcA5yjFys9E6GjPlNuOhu3/gY1VPglgPSwlcG6bTqTlf9XkcUAvy', 'rabia.admin@sportshub.lhr.edu',    'admin',   'Rabia Tariq',         '+92-321-9990000', 4),
('bilalahmed',   '$2b$10$4rcA5yjFys9E6GjPlNuOhu3/gY1VPglgPSwlcG6bTqTlf9XkcUAvy', 'bilal.ahmed@student.lhr.edu',      'student', 'Bilal Ahmed',         '+92-334-2221100', 1),
('mehwishkhan',  '$2b$10$4rcA5yjFys9E6GjPlNuOhu3/gY1VPglgPSwlcG6bTqTlf9XkcUAvy', 'mehwish.khan@student.lhr.edu',     'student', 'Mehwish Khan',        '+92-303-8887766', 3),
('talhaiqbal',   '$2b$10$4rcA5yjFys9E6GjPlNuOhu3/gY1VPglgPSwlcG6bTqTlf9XkcUAvy', 'talha.iqbal@student.lhr.edu',      'student', 'Talha Iqbal',         '+92-315-3334455', 2),
('zaranaeem',    '$2b$10$4rcA5yjFys9E6GjPlNuOhu3/gY1VPglgPSwlcG6bTqTlf9XkcUAvy', 'zara.naeem@student.lhr.edu',       'student', 'Zara Naeem',          '+92-306-7776655', 1),
('kashan_staff', '$2b$10$4rcA5yjFys9E6GjPlNuOhu3/gY1VPglgPSwlcG6bTqTlf9XkcUAvy', 'kashan.javed@staff.lhr.edu',       'staff',   'Kashan Javed',        '+92-320-5559988', 3);

-----------------------------------------------------------
-- facilities (real Lahore sports venues)
-----------------------------------------------------------
insert into facilities (name, description, capacity, is_auctionable) values
('Gaddafi Stadium - Cricket Ground',        'Iconic international cricket venue at Nishtar Park Sports Complex, Gulberg. Capacity 27,000.', 200, 1),
('Punjab International Swimming Complex',   'Olympic-size swimming pool at Nishtar Park Sports Complex, near Gaddafi Stadium.', 60, 0),
('LDA Sports Complex Gulberg - Tennis Courts','Multi-court tennis facility at LDA Sports Complex, Gulberg III, Lahore.', 16, 0),
('LDA Sports Complex Gulberg - Badminton Hall','Indoor badminton hall with 4 courts at LDA Complex Gulberg.', 32, 0),
('LDA Sports Complex Johar Town - Football Ground','Full-size football pitch at LDA Sports Complex, Johar Town, Lahore.', 100, 1),
('5th Generation Complex - Indoor Court',   '24/7 multi-sport indoor court (basketball, volleyball, badminton) near DHA Phase 5, Lahore.', 40, 0),
('5th Generation Complex - Swimming Pool',  'Heated swimming pool with separate timings at 5th Generation Leisure Complex.', 30, 0),
('Futsalrange DHA - Futsal Arena',          'Professional futsal pitches at Futsalrange, DHA Phase 6, Lahore.', 20, 0),
('Futsalrange Wapda Town - Indoor Cricket', 'Indoor cricket nets and pitches at Futsalrange, Wapda Town, Lahore.', 24, 0),
('Bagh-e-Jinnah Cricket Ground',            'Historic cricket ground inside Bagh-e-Jinnah (Lawrence Gardens), The Mall, Lahore.', 80, 1),
('LDA Sports Complex Sabzazar - Gym',       'Fully equipped gymnasium at LDA Sports Complex, Sabzazar, Lahore.', 50, 0),
('Lahore Gymkhana - Squash Courts',         'Premium squash courts at Lahore Gymkhana Club, The Mall Road.', 8, 0);

-----------------------------------------------------------
-- timeslots (campus-friendly slots from 6 AM to 10 PM)
-----------------------------------------------------------
insert into timeslots (starttime, endtime) values
('06:00', '07:00'),
('07:00', '08:00'),
('08:00', '09:00'),
('09:00', '10:00'),
('10:00', '11:00'),
('11:00', '12:00'),
('12:00', '13:00'),
('13:00', '14:00'),
('14:00', '15:00'),
('15:00', '16:00'),
('16:00', '17:00'),
('17:00', '18:00'),
('18:00', '19:00'),
('19:00', '20:00'),
('20:00', '21:00'),
('21:00', '22:00');

-----------------------------------------------------------
-- maintenance_schedules
-----------------------------------------------------------
insert into maintenance_schedules (facilityid, maintdate, reason) values
(1, '2026-04-20', 'Pitch resurfacing and roller treatment after PSL matches'),
(2, '2026-04-22', 'Pool chlorination and filter cleaning cycle'),
(5, '2026-04-18', 'Football ground re-marking and goal post inspection'),
(6, '2026-04-25', 'Indoor court floor polishing and net replacement'),
(11, '2026-04-21', 'Gym equipment servicing and safety inspection'),
(10, '2026-05-01', 'Outfield mowing and boundary rope replacement');

-----------------------------------------------------------
-- bookings (25+ bookings across various facilities and dates)
-----------------------------------------------------------
insert into bookings (userid, facilityid, slotid, bookingdate, finalprice, status) values
-- Gaddafi Stadium
(1,  1,  10, '2026-04-15', 5000.00, 'confirmed'),
(3,  1,  11, '2026-04-15', 5000.00, 'confirmed'),
(5,  1,  12, '2026-04-16', 4500.00, 'pending'),
(13, 1,  14, '2026-04-17', 0.00,    'open_bid'),
-- Punjab Swimming Complex
(2,  2,  3,  '2026-04-15', 800.00,  'confirmed'),
(4,  2,  4,  '2026-04-15', 800.00,  'confirmed'),
(12, 2,  5,  '2026-04-16', 750.00,  'completed'),
-- LDA Tennis Courts
(6,  3,  9,  '2026-04-15', 1200.00, 'confirmed'),
(7,  3,  10, '2026-04-15', 1200.00, 'pending'),
(14, 3,  11, '2026-04-16', 1100.00, 'confirmed'),
-- LDA Badminton Hall
(1,  4,  13, '2026-04-15', 600.00,  'confirmed'),
(11, 4,  14, '2026-04-16', 600.00,  'confirmed'),
-- LDA Johar Town Football
(3,  5,  15, '2026-04-19', 3500.00, 'confirmed'),
(5,  5,  16, '2026-04-19', 0.00,    'open_bid'),
-- 5th Generation Indoor Court
(8,  6,  7,  '2026-04-15', 2000.00, 'confirmed'),
(13, 6,  8,  '2026-04-16', 2000.00, 'pending'),
-- 5th Generation Swimming Pool
(2,  7,  3,  '2026-04-17', 900.00,  'confirmed'),
(14, 7,  4,  '2026-04-17', 900.00,  'confirmed'),
-- Futsalrange DHA Futsal
(1,  8,  12, '2026-04-15', 3000.00, 'confirmed'),
(5,  8,  13, '2026-04-16', 2800.00, 'completed'),
-- Futsalrange Wapda Town Indoor Cricket
(3,  9,  14, '2026-04-15', 2500.00, 'confirmed'),
(11, 9,  15, '2026-04-16', 2500.00, 'pending'),
-- Bagh-e-Jinnah Cricket Ground
(13, 10, 10, '2026-04-15', 0.00,    'open_bid'),
(1,  10, 11, '2026-04-16', 2000.00, 'confirmed'),
-- LDA Sabzazar Gym
(4,  11, 6,  '2026-04-15', 500.00,  'confirmed'),
(12, 11, 7,  '2026-04-16', 500.00,  'confirmed'),
-- Lahore Gymkhana Squash
(6,  12, 9,  '2026-04-15', 1500.00, 'confirmed'),
(7,  12, 10, '2026-04-16', 1500.00, 'completed'),
-- cancelled booking
(8,  3,  12, '2026-04-17', 1200.00, 'cancelled');

-----------------------------------------------------------
-- bids (for the 3 open_bid bookings: IDs 4, 14, 23)
-----------------------------------------------------------
insert into bids (bookingid, userid, bidamount) values
-- Gaddafi Stadium open_bid (bookingid 4)
(4, 1,  5500.00),
(4, 3,  6000.00),
(4, 5,  6200.00),
(4, 11, 7000.00),
-- LDA Johar Town Football open_bid (bookingid 14)
(14, 1,  3800.00),
(14, 12, 4200.00),
(14, 13, 4500.00),
-- Bagh-e-Jinnah open_bid (bookingid 23)
(23, 3,  2200.00),
(23, 5,  2500.00),
(23, 14, 2800.00);

-----------------------------------------------------------
-- equipment & equipment_rentals
-----------------------------------------------------------
insert into equipment (itemname, totalstock, hourlyrate) values
('Cricket Kit (Full)',       20, 250.00),
('Football',                30, 100.00),
('Tennis Racket',            15, 150.00),
('Badminton Racket',         25, 80.00),
('Swimming Goggles',         40, 50.00),
('Basketball',               12, 120.00),
('Squash Racket',            10, 200.00),
('Futsal Ball',              18, 90.00),
('Gym Locker Key',           50, 30.00),
('Cricket Batting Pads',     15, 180.00);

insert into equipment_rentals (bookingid, itemid, qty) values
(1,  1, 2),   -- Cricket kits for Gaddafi Stadium booking
(2,  1, 3),   -- More cricket kits
(5,  5, 2),   -- Swimming goggles at Punjab pool
(6,  5, 1),   -- Swimming goggles
(8,  3, 2),   -- Tennis rackets at LDA
(9,  3, 2),   -- Tennis rackets
(11, 4, 4),   -- Badminton rackets at LDA
(15, 6, 2),   -- Basketballs at 5th Gen
(19, 8, 1),   -- Futsal ball at Futsalrange
(21, 1, 4),   -- Cricket kits at Wapda Town
(27, 7, 2),   -- Squash rackets at Gymkhana
(25, 9, 1);   -- Gym locker at Sabzazar

-----------------------------------------------------------
-- waitlists
-----------------------------------------------------------
insert into waitlists (bookingid, userid, prioritylevel) values
(3,  11, 1),   -- waiting for Gaddafi slot
(3,  12, 2),   -- higher priority
(16, 1,  1),   -- waiting for 5th Gen Indoor Court
(22, 5,  1),   -- waiting for Wapda Town slot
(22, 14, 3);   -- highest priority for Wapda Town

-----------------------------------------------------------
-- payments
-----------------------------------------------------------
insert into payments (bookingid, amount, paymentmethod, paymentdate) values
(1,  5000.00, 'JazzCash',          '2026-04-14 10:30:00'),
(2,  5000.00, 'EasyPaisa',         '2026-04-14 11:00:00'),
(5,  800.00,  'Credit Card',       '2026-04-14 08:15:00'),
(6,  800.00,  'Cash',              '2026-04-14 09:00:00'),
(7,  750.00,  'JazzCash',          '2026-04-13 17:45:00'),
(8,  1200.00, 'Bank Transfer',     '2026-04-14 14:00:00'),
(10, 1100.00, 'EasyPaisa',         '2026-04-15 10:00:00'),
(11, 600.00,  'Cash',              '2026-04-14 12:30:00'),
(12, 600.00,  'JazzCash',          '2026-04-15 08:00:00'),
(13, 3500.00, 'Credit Card',       '2026-04-17 09:30:00'),
(15, 2000.00, 'EasyPaisa',         '2026-04-14 07:00:00'),
(17, 900.00,  'Cash',              '2026-04-16 06:30:00'),
(18, 900.00,  'JazzCash',          '2026-04-16 07:00:00'),
(19, 3000.00, 'Credit Card',       '2026-04-14 12:00:00'),
(20, 2800.00, 'EasyPaisa',         '2026-04-15 18:30:00'),
(21, 2500.00, 'Bank Transfer',     '2026-04-14 14:45:00'),
(24, 2000.00, 'Cash',              '2026-04-15 11:00:00'),
(25, 500.00,  'JazzCash',          '2026-04-14 06:00:00'),
(26, 500.00,  'EasyPaisa',         '2026-04-15 07:30:00'),
(27, 1500.00, 'Credit Card',       '2026-04-14 09:15:00'),
(28, 1500.00, 'Cash',              '2026-04-15 10:30:00');

-----------------------------------------------------------
-- reviews (feedback on Lahore facilities)
-----------------------------------------------------------
insert into reviews (userid, facilityid, rating, comment) values
(1,  1, 5, 'Gaddafi Stadium is world-class! Excellent pitch and atmosphere, felt like playing in a PSL match.'),
(3,  1, 4, 'Great ground but the changing rooms could use some renovation. Pitch quality is top notch.'),
(2,  2, 5, 'Punjab Swimming Complex has an Olympic-size pool. Water quality and temperature are perfect.'),
(4,  2, 4, 'Good facility, but gets quite crowded during evening slots. Morning sessions are ideal.'),
(6,  3, 4, 'LDA Tennis Courts are well-maintained. Court surface is consistent and fair for competitive play.'),
(7,  3, 3, 'Decent courts but the lighting for evening sessions could be improved significantly.'),
(1,  4, 5, 'Badminton hall at LDA Gulberg is excellent. Good ventilation, proper nets, and smooth flooring.'),
(5,  5, 4, 'LDA Johar Town football ground is spacious. Grass quality is good but could be watered more often.'),
(8,  6, 5, '5th Generation indoor court is fantastic — 24/7 availability is a game changer for night owls.'),
(13, 6, 4, 'Clean and professional setup. The multi-sport flexibility is very convenient for our group.'),
(2,  7, 4, '5th Gen pool is nice and heated. Smaller than Punjab Swimming Complex but less crowded.'),
(1,  8, 5, 'Futsalrange DHA has the best futsal pitches in Lahore. Professional-grade turf and lighting.'),
(5,  8, 4, 'Great pitch quality. Only downside is parking can be tight during peak hours at DHA.'),
(3,  9, 4, 'Wapda Town indoor cricket facility is solid. Nets are well-maintained and bowlers love it.'),
(11, 10, 5,'Bagh-e-Jinnah ground has such historical charm. Playing cricket here feels special.'),
(4,  11, 4, 'LDA Sabzazar Gym has modern equipment. Clean environment and affordable rates.'),
(12, 11, 3, 'Gym is okay but some machines need replacement. Treadmills are a bit worn out.'),
(6,  12, 5, 'Lahore Gymkhana squash courts are premium. Best maintained courts in the city, hands down.'),
(7,  12, 4, 'Excellent facility at Gymkhana. The court floors are perfectly smooth. Great for serious players.');

-----------------------------------------------------------
-- notifications
-----------------------------------------------------------
insert into notifications (userid, message, isread) values
(1,  'Your booking #1 at Gaddafi Stadium has been confirmed. Enjoy your game!', 1),
(1,  'Reminder: Your Futsalrange DHA session is tomorrow at 12:00 PM.', 0),
(2,  'Your swimming session at Punjab International Swimming Complex is confirmed.', 1),
(3,  'You have been outbid on Gaddafi Stadium auction. Current highest: Rs 7,000.', 0),
(5,  'penalty: Late cancellation fee of Rs 500 applied to your account.', 0),
(5,  'Your bid of Rs 6,200 on Gaddafi Stadium is currently third highest.', 1),
(8,  'Your booking at LDA Tennis Courts has been cancelled.', 1),
(11, 'You are on the waitlist for Gaddafi Stadium slot (Priority: 1). We will notify you if it opens.', 0),
(12, 'penalty: No-show penalty of Rs 300 applied for missed swimming session.', 0),
(13, 'Your bid of Rs 4,500 is winning for LDA Johar Town Football Ground!', 0),
(14, 'Your booking at 5th Generation Swimming Pool is confirmed for Apr 17.', 1),
(3,  'Maintenance scheduled at LDA Johar Town Football on Apr 18 — your booking is unaffected.', 1);

-----------------------------------------------------------
-- audit_logs
-----------------------------------------------------------
insert into audit_logs (adminid, actionperformed) values
(9,  'Created 12 facilities for Lahore Sports Hub system'),
(9,  'Approved Gold membership for user ayeshafatima (userid 4)'),
(10, 'Scheduled maintenance for Gaddafi Stadium on 2026-04-20'),
(10, 'Opened bidding for Gaddafi Stadium booking #4'),
(9,  'Applied penalty notification to userid 5 for late cancellation'),
(10, 'Approved bulk timeslots (06:00–22:00) for all facilities'),
(9,  'Verified and activated Futsalrange DHA and Wapda Town facilities'),
(10, 'Generated monthly revenue report for March 2026');
