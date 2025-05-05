-- First drop the existing foreign key constraint
ALTER TABLE bookings 
DROP CONSTRAINT IF EXISTS bookings_assigned_vehicle_id_fkey;

-- Change the column type from integer to text
ALTER TABLE bookings 
ALTER COLUMN assigned_vehicle_id TYPE text USING assigned_vehicle_id::text;

-- Update the foreign key to reference vehicles.vehicle_number instead of vehicles.id
ALTER TABLE bookings
ADD CONSTRAINT bookings_assigned_vehicle_id_fkey 
FOREIGN KEY (assigned_vehicle_id) 
REFERENCES vehicles(vehicle_number);