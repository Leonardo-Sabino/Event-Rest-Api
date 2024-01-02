class Event {
  constructor(
    id,
    name,
    description,
    starttime,
    endtime,
    date,
    price,
    userId,
    ownerContact
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.starttime = starttime;
    this.endtime = endtime;
    this.date = date;
    this.price = price;
    this.userId = userId;
    this.ownerContact = ownerContact;
  }

  //add methods to perform operations related to events updateEvent, deleteEvent
}
